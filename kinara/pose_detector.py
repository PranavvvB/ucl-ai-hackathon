"""
Pose detection engine using MediaPipe PoseLandmarker (Tasks API, v0.10.30+).
Extracts 33 body landmarks per frame from video.
"""

import os
import cv2
import numpy as np
import mediapipe as mp
from dataclasses import dataclass
from typing import Optional

BaseOptions = mp.tasks.BaseOptions
PoseLandmarker = mp.tasks.vision.PoseLandmarker
PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
RunningMode = mp.tasks.vision.RunningMode

# Default model path (relative to project root)
# Use 'full' model — ~3x faster than heavy with negligible accuracy loss for
# joint angle tracking.  Falls back to heavy if full not present.
# Force the directory to be the same folder as this script
_MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
_FULL_PATH = os.path.join(_MODEL_DIR, "pose_landmarker_full.task")

# Force it to use the Full path regardless of the heavy fallback
DEFAULT_MODEL_PATH = _FULL_PATH


@dataclass
class LandmarkData:
    """Simple landmark data container."""
    x: float
    y: float
    z: float
    visibility: float


@dataclass
class FramePose:
    """Pose data for a single frame."""
    frame_idx: int
    timestamp_ms: float
    landmarks: Optional[list[LandmarkData]] = None  # list of 33 landmarks (normalized)
    world_landmarks: Optional[list[LandmarkData]] = None  # 3D world coordinates
    visibility_avg: float = 0.0

    @property
    def detected(self) -> bool:
        return self.landmarks is not None and len(self.landmarks) > 0


class PoseDetector:
    """
    Wraps MediaPipe PoseLandmarker (Tasks API) for video pose extraction.
    """

    # Key landmark indices (MediaPipe Pose)
    NOSE = 0
    LEFT_SHOULDER = 11
    RIGHT_SHOULDER = 12
    LEFT_ELBOW = 13
    RIGHT_ELBOW = 14
    LEFT_WRIST = 15
    RIGHT_WRIST = 16
    LEFT_HIP = 23
    RIGHT_HIP = 24
    LEFT_KNEE = 25
    RIGHT_KNEE = 26
    LEFT_ANKLE = 27
    RIGHT_ANKLE = 28
    LEFT_HEEL = 29
    RIGHT_HEEL = 30
    LEFT_FOOT_INDEX = 31
    RIGHT_FOOT_INDEX = 32

    def __init__(
        self,
        model_complexity: int = 1,
        min_detection_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5,
        model_path: str = None,
    ):
        if model_path is None:
            model_path = DEFAULT_MODEL_PATH

        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"PoseLandmarker model not found at: {model_path}\n"
                "Download it with:\n"
                "  Invoke-WebRequest -Uri 'https://storage.googleapis.com/mediapipe-models/"
                "pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task'"
                " -OutFile 'models/pose_landmarker_heavy.task'"
            )

        self.model_path = model_path
        self.min_detection_confidence = min_detection_confidence
        self.min_tracking_confidence = min_tracking_confidence

    @staticmethod
    def _convert_landmarks(mp_landmarks) -> list[LandmarkData]:
        """Convert MediaPipe NormalizedLandmark list to our LandmarkData list."""
        result = []
        for lm in mp_landmarks:
            vis = lm.visibility if hasattr(lm, 'visibility') and lm.visibility is not None else 0.5
            result.append(LandmarkData(x=lm.x, y=lm.y, z=lm.z, visibility=vis))
        return result

    def process_frame(self, frame: np.ndarray, frame_idx: int = 0, timestamp_ms: float = 0.0) -> FramePose:
        """Process a single BGR frame (IMAGE mode) and return pose data."""
        options = PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=self.model_path),
            running_mode=RunningMode.IMAGE,
            num_poses=1,
            min_pose_detection_confidence=self.min_detection_confidence,
            min_pose_presence_confidence=self.min_detection_confidence,
            min_tracking_confidence=self.min_tracking_confidence,
        )
        landmarker = PoseLandmarker.create_from_options(options)

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = landmarker.detect(mp_image)
        landmarker.close()

        if result.pose_landmarks and len(result.pose_landmarks) > 0:
            landmarks = self._convert_landmarks(result.pose_landmarks[0])
            world_lm = None
            if result.pose_world_landmarks and len(result.pose_world_landmarks) > 0:
                world_lm = self._convert_landmarks(result.pose_world_landmarks[0])
            vis_avg = np.mean([lm.visibility for lm in landmarks])
            return FramePose(
                frame_idx=frame_idx,
                timestamp_ms=timestamp_ms,
                landmarks=landmarks,
                world_landmarks=world_lm,
                visibility_avg=vis_avg,
            )
        return FramePose(frame_idx=frame_idx, timestamp_ms=timestamp_ms)

    # Max width to resize frames to before pose inference.
    # Full-res 1080p inference is much slower than needed — 640px is plenty
    # for landmark accuracy and gives a big speedup on CPU/iGPU.
    INFERENCE_WIDTH = 640

    def process_video(self, video_path: str, sample_every_n: int = 3) -> tuple[list[FramePose], dict]:
        """
        Process entire video file using VIDEO mode for tracking.
        Processes every `sample_every_n` frames and resizes to INFERENCE_WIDTH
        before inference for speed.  Returns (list of FramePose, video_info dict).
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration_s = total_frames / fps if fps > 0 else 0

        video_info = {
            "fps": fps,
            "total_frames": total_frames,
            "width": width,
            "height": height,
            "duration_s": round(duration_s, 2),
        }

        # Create a fresh video-mode landmarker
        options = PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=self.model_path),
            running_mode=RunningMode.VIDEO,
            num_poses=1,
            min_pose_detection_confidence=self.min_detection_confidence,
            min_pose_presence_confidence=self.min_detection_confidence,
            min_tracking_confidence=self.min_tracking_confidence,
        )
        landmarker = PoseLandmarker.create_from_options(options)

        poses: list[FramePose] = []
        frame_idx = 0
        last_ts = -1

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_every_n == 0:
                timestamp_ms = int(cap.get(cv2.CAP_PROP_POS_MSEC))
                # Ensure strictly increasing timestamps
                if timestamp_ms <= last_ts:
                    timestamp_ms = last_ts + 1
                last_ts = timestamp_ms

                # Resize for faster inference (landmarks are normalized 0-1
                # so resizing doesn't affect their values)
                h_orig, w_orig = frame.shape[:2]
                if w_orig > self.INFERENCE_WIDTH:
                    scale = self.INFERENCE_WIDTH / w_orig
                    frame_small = cv2.resize(frame, (self.INFERENCE_WIDTH, int(h_orig * scale)),
                                             interpolation=cv2.INTER_AREA)
                else:
                    frame_small = frame

                rgb = cv2.cvtColor(frame_small, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

                try:
                    result = landmarker.detect_for_video(mp_image, timestamp_ms)

                    if result.pose_landmarks and len(result.pose_landmarks) > 0:
                        landmarks = self._convert_landmarks(result.pose_landmarks[0])
                        world_lm = None
                        if result.pose_world_landmarks and len(result.pose_world_landmarks) > 0:
                            world_lm = self._convert_landmarks(result.pose_world_landmarks[0])
                        vis_avg = np.mean([lm.visibility for lm in landmarks])
                        poses.append(FramePose(
                            frame_idx=frame_idx,
                            timestamp_ms=float(timestamp_ms),
                            landmarks=landmarks,
                            world_landmarks=world_lm,
                            visibility_avg=vis_avg,
                        ))
                    else:
                        poses.append(FramePose(frame_idx=frame_idx, timestamp_ms=float(timestamp_ms)))
                except Exception:
                    poses.append(FramePose(frame_idx=frame_idx, timestamp_ms=float(timestamp_ms)))

            frame_idx += 1

        cap.release()
        landmarker.close()
        return poses, video_info

    def draw_pose(self, frame: np.ndarray, frame_pose: FramePose) -> np.ndarray:
        """Draw pose landmarks on a frame. Returns annotated frame."""
        if not frame_pose.detected:
            return frame

        annotated = frame.copy()
        h, w = annotated.shape[:2]

        # USE THE STABLE SOLUTIONS API FOR CONNECTIONS
        connections = mp.solutions.pose.POSE_CONNECTIONS
        landmarks = frame_pose.landmarks

        # Draw connections (Tuple unpacking instead of .start/.end)
        for start_idx, end_idx in connections:
            if start_idx < len(landmarks) and end_idx < len(landmarks):
                start_lm = landmarks[start_idx]
                end_lm = landmarks[end_idx]
                start_pt = (int(start_lm.x * w), int(start_lm.y * h))
                end_pt = (int(end_lm.x * w), int(end_lm.y * h))
                if (0 <= start_pt[0] < w and 0 <= start_pt[1] < h and
                    0 <= end_pt[0] < w and 0 <= end_pt[1] < h):
                    cv2.line(annotated, start_pt, end_pt, (0, 255, 0), 2)

        # Draw landmarks as circles
        for lm in landmarks:
            pt = (int(lm.x * w), int(lm.y * h))
            if 0 <= pt[0] < w and 0 <= pt[1] < h:
                cv2.circle(annotated, pt, 4, (0, 0, 255), -1)

        return annotated

    @staticmethod
    def get_landmark_coords(landmarks: list[LandmarkData], idx: int, frame_shape: tuple = None) -> tuple:
        """
        Get (x, y) normalized coords for a landmark.
        If frame_shape provided, returns pixel coords (x_px, y_px).
        """
        lm = landmarks[idx]
        if frame_shape:
            h, w = frame_shape[:2]
            return (int(lm.x * w), int(lm.y * h))
        return (lm.x, lm.y)

    @staticmethod
    def calculate_angle(a: tuple, b: tuple, c: tuple) -> float:
        """
        Calculate angle at point b given three points (a, b, c).
        Each point is (x, y). Returns angle in degrees [0-180].
        """
        a = np.array(a[:2])
        b = np.array(b[:2])
        c = np.array(c[:2])

        ba = a - b
        bc = c - b

        cosine = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
        cosine = np.clip(cosine, -1.0, 1.0)
        angle = np.degrees(np.arccos(cosine))
        return angle

    def close(self):
        pass  # Landmarkers are closed after each use now

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
