"""
Video annotator: draws pose skeleton, joint angles, rep count,
and exercise info overlay on each frame, then outputs an annotated video.
"""

import cv2
import numpy as np
from typing import Optional
from pose_detector import PoseDetector, FramePose
from metrics_analyzer import RepData


class VideoAnnotator:
    """Generates annotated output video with pose overlay and stats."""

    # Colors (BGR)
    GREEN = (0, 255, 0)
    RED = (0, 0, 255)
    BLUE = (255, 150, 0)
    YELLOW = (0, 255, 255)
    WHITE = (255, 255, 255)
    BLACK = (0, 0, 0)
    ORANGE = (0, 165, 255)

    def __init__(self, pose_detector: PoseDetector):
        self.pd = pose_detector

    def _draw_angle_arc(
        self, frame: np.ndarray, landmarks, joint_indices: tuple,
        frame_shape: tuple, color: tuple = None, label: str = ""
    ):
        """Draw angle measurement at a joint."""
        if color is None:
            color = self.YELLOW

        a_idx, b_idx, c_idx = joint_indices
        a = PoseDetector.get_landmark_coords(landmarks, a_idx, frame_shape)
        b = PoseDetector.get_landmark_coords(landmarks, b_idx, frame_shape)
        c = PoseDetector.get_landmark_coords(landmarks, c_idx, frame_shape)

        angle = PoseDetector.calculate_angle(a, b, c)

        # Draw angle text near joint
        text = f"{angle:.0f}°"
        if label:
            text = f"{label}: {text}"

        # Offset text slightly
        tx = b[0] + 15
        ty = b[1] - 10

        cv2.putText(frame, text, (tx, ty), cv2.FONT_HERSHEY_SIMPLEX,
                     0.5, self.BLACK, 3, cv2.LINE_AA)
        cv2.putText(frame, text, (tx, ty), cv2.FONT_HERSHEY_SIMPLEX,
                     0.5, color, 1, cv2.LINE_AA)

        return angle

    def _draw_info_panel(
        self, frame: np.ndarray, exercise_type: str,
        rep_count: int, current_angle: float,
        rpe: float, technique_score: float,
        frame_idx: int, total_frames: int
    ):
        """Draw translucent info panel with stats."""
        h, w = frame.shape[:2]
        panel_h = 180
        panel_w = 300

        # Create overlay
        overlay = frame.copy()
        cv2.rectangle(overlay, (10, 10), (10 + panel_w, 10 + panel_h),
                       self.BLACK, -1)
        cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)

        # Draw text
        y = 35
        line_height = 25
        font = cv2.FONT_HERSHEY_SIMPLEX
        scale = 0.55

        exercise_display = exercise_type.replace("_", " ").title()
        items = [
            (f"Exercise: {exercise_display}", self.GREEN),
            (f"Reps: {rep_count}", self.WHITE),
            (f"Joint Angle: {current_angle:.0f} deg", self.YELLOW),
            (f"Est. RPE: {rpe:.1f}/10", self.ORANGE if rpe > 7 else self.WHITE),
            (f"Technique: {technique_score:.0f}/100", self.GREEN if technique_score > 70 else self.RED),
            (f"Frame: {frame_idx}/{total_frames}", self.WHITE),
        ]

        for text, color in items:
            cv2.putText(frame, text, (20, y), font, scale, color, 1, cv2.LINE_AA)
            y += line_height

    def _draw_rep_marker(self, frame: np.ndarray, rep_number: int):
        """Flash a rep count indicator when a new rep is completed."""
        h, w = frame.shape[:2]
        text = f"REP {rep_number}"
        text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 1.5, 3)[0]
        tx = (w - text_size[0]) // 2
        ty = h // 4

        cv2.putText(frame, text, (tx, ty), cv2.FONT_HERSHEY_SIMPLEX,
                     1.5, self.BLACK, 5, cv2.LINE_AA)
        cv2.putText(frame, text, (tx, ty), cv2.FONT_HERSHEY_SIMPLEX,
                     1.5, self.GREEN, 3, cv2.LINE_AA)

    def annotate_video(
        self,
        input_path: str,
        output_path: str,
        poses: list[FramePose],
        exercise_type: str,
        reps: list[RepData],
        rpe: float = 0.0,
        technique_score: float = 0.0,
        primary_joints: tuple = None,
        progress_callback=None,
    ) -> str:
        """
        Create annotated video with pose overlay and metrics.
        Returns output_path.
        """
        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {input_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        # Build frame->pose lookup (poses may be sampled, not every frame)
        pose_map = {p.frame_idx: p for p in poses}

        # Build frame->rep count lookup
        rep_count_at_frame = {}
        for rep in reps:
            rep_count_at_frame[rep.end_frame] = rep.rep_number

        # Determine which angle joints to display
        if primary_joints is None:
            if exercise_type == "squat":
                primary_joints = (
                    PoseDetector.LEFT_HIP, PoseDetector.LEFT_KNEE, PoseDetector.LEFT_ANKLE
                )
            elif exercise_type == "bench_press":
                primary_joints = (
                    PoseDetector.LEFT_SHOULDER, PoseDetector.LEFT_ELBOW, PoseDetector.LEFT_WRIST
                )
            elif exercise_type == "deadlift":
                primary_joints = (
                    PoseDetector.LEFT_SHOULDER, PoseDetector.LEFT_HIP, PoseDetector.LEFT_KNEE
                )
            else:
                primary_joints = (
                    PoseDetector.LEFT_HIP, PoseDetector.LEFT_KNEE, PoseDetector.LEFT_ANKLE
                )

        frame_idx = 0
        running_rep_count = 0
        last_annotated_frame = None  # reuse annotation for skipped frames
        last_angle = 0.0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            # Update rep count
            if frame_idx in rep_count_at_frame:
                running_rep_count = rep_count_at_frame[frame_idx]

            pose = pose_map.get(frame_idx)

            if pose is not None:
                # This is a sampled frame — draw fresh annotations
                current_angle = 0.0
                if pose.detected:
                    frame = self.pd.draw_pose(frame, pose)
                    current_angle = self._draw_angle_arc(
                        frame, pose.landmarks, primary_joints,
                        (height, width), self.YELLOW
                    )
                last_angle = current_angle

                self._draw_info_panel(
                    frame, exercise_type, running_rep_count,
                    current_angle, rpe, technique_score,
                    frame_idx, total_frames
                )

                # Flash rep marker
                for rep in reps:
                    flash_range = int(fps * 0.5)
                    if rep.end_frame <= frame_idx <= rep.end_frame + flash_range:
                        self._draw_rep_marker(frame, rep.rep_number)
                        break

            else:
                # Non-sampled frame — still draw panel with last known values
                self._draw_info_panel(
                    frame, exercise_type, running_rep_count,
                    last_angle, rpe, technique_score,
                    frame_idx, total_frames
                )
                for rep in reps:
                    flash_range = int(fps * 0.5)
                    if rep.end_frame <= frame_idx <= rep.end_frame + flash_range:
                        self._draw_rep_marker(frame, rep.rep_number)
                        break

            out.write(frame)
            frame_idx += 1

            if progress_callback and frame_idx % 30 == 0:
                progress_callback(frame_idx, total_frames)

        cap.release()
        out.release()
        return output_path
