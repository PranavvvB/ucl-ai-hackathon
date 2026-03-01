"""
Rep counter & metrics analyzer.
Detects reps by tracking joint angle oscillations, then computes:
- Rep count
- Rep timing / tempo
- Estimated RPE (Rate of Perceived Exertion) from rep speed degradation
- Fatigue index (how much slower/shakier later reps are vs first)
- Technique score (consistency of range of motion, symmetry)
"""

import numpy as np
from dataclasses import dataclass, field
from typing import Optional
from pose_detector import PoseDetector, FramePose


@dataclass
class RepData:
    """Data for a single rep."""
    rep_number: int
    start_frame: int
    bottom_frame: int
    end_frame: int
    start_time_s: float
    bottom_time_s: float
    end_time_s: float
    duration_s: float
    concentric_duration_s: float  # bottom to top (effort phase)
    eccentric_duration_s: float   # top to bottom (lowering phase)
    min_angle: float              # deepest point angle (primary joint)
    max_angle: float              # top position angle
    range_of_motion: float        # max - min angle
    symmetry_score: float         # 0-1, how symmetric left vs right
    smoothness_score: float       # 0-1, how smooth the motion curve is
    status: str = "completed"     # "completed" or "failed"
    rpe: float = 0.0              # per-rep RPE estimate (1-10)


@dataclass
class AnalysisResult:
    """Complete analysis result for a video."""
    exercise_type: str
    exercise_confidence: float
    total_reps: int
    reps: list[RepData]
    avg_rep_duration_s: float
    avg_rom: float              # average range of motion
    technique_score: float      # 0-100
    estimated_rpe: float        # 1-10 scale
    fatigue_index: float        # 0-1, how much performance degrades
    symmetry_avg: float         # 0-1 average symmetry (trajectory correlation)
    notes: list[str]            # human-readable notes about the set
    angle_curves: dict          # raw angle data for plotting


class MetricsAnalyzer:
    """Analyzes pose sequences to extract exercise metrics."""

    # Primary tracking angles per exercise
    EXERCISE_ANGLES = {
        "squat": {
            "primary": ("hip", "knee", "ankle"),       # knee angle
            "secondary": ("shoulder", "hip", "knee"),   # hip angle
        },
        "bench_press": {
            "primary": ("shoulder", "elbow", "wrist"),  # elbow angle
            "secondary": ("shoulder", "elbow", "wrist"),
        },
        "deadlift": {
            "primary": ("shoulder", "hip", "knee"),     # hip angle
            "secondary": ("hip", "knee", "ankle"),      # knee angle
        },
    }
    EXERCISE_PARAMS = {
        "squat": {
            "lockout_angle": 165.0,
            "work_angle": 85.0,
            "sec_min_dip": 20.0,
            "min_angle_range": 15.0,
            "concentric_fail_frac": 0.40,
            "eccentric_fail_frac": 0.40,
            "rom_fail_frac": 0.30,
        },
        "bench_press": {
            "lockout_angle": 170.0,      # elbow near lockout
            "work_angle": 100.0,         # elbow more flexed at bottom
            "sec_min_dip": 10.0,         # secondary angle smaller swing
            "min_angle_range": 10.0,     # bench ROM in degrees is smaller
            "concentric_fail_frac": 0.40,
            "eccentric_fail_frac": 0.40,
            "rom_fail_frac": 0.30,
        },
        "deadlift": {
            "lockout_angle": 165.0,      # hip near extension
            "work_angle": 110.0,
            "sec_min_dip": 15.0,
            "min_angle_range": 12.0,
            "concentric_fail_frac": 0.40,
            "eccentric_fail_frac": 0.40,
            "rom_fail_frac": 0.30,
        },
    }

    # Landmark mapping for joint names
    JOINT_MAP = {
        "shoulder": (PoseDetector.LEFT_SHOULDER, PoseDetector.RIGHT_SHOULDER),
        "elbow": (PoseDetector.LEFT_ELBOW, PoseDetector.RIGHT_ELBOW),
        "wrist": (PoseDetector.LEFT_WRIST, PoseDetector.RIGHT_WRIST),
        "hip": (PoseDetector.LEFT_HIP, PoseDetector.RIGHT_HIP),
        "knee": (PoseDetector.LEFT_KNEE, PoseDetector.RIGHT_KNEE),
        "ankle": (PoseDetector.LEFT_ANKLE, PoseDetector.RIGHT_ANKLE),
    }

    def __init__(self):
        pass

    def _get_joint_angle(self, landmarks, joint_a: str, joint_b: str, joint_c: str, side: str = "left") -> float:
        """Get angle at joint_b between joint_a and joint_c."""
        idx = 0 if side == "left" else 1
        a = landmarks[self.JOINT_MAP[joint_a][idx]]
        b = landmarks[self.JOINT_MAP[joint_b][idx]]
        c = landmarks[self.JOINT_MAP[joint_c][idx]]
        return PoseDetector.calculate_angle((a.x, a.y), (b.x, b.y), (c.x, c.y))

    def _extract_angle_series(
        self, poses: list[FramePose], joint_a: str, joint_b: str, joint_c: str
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, list[int]]:
        """
        Extract left, right, and average angle series + timestamps from poses.
        Returns (left_angles, right_angles, avg_angles, timestamps_s, frame_indices)
        where frame_indices[i] is the original video frame index for sample i.
        """
        left_angles = []
        right_angles = []
        timestamps = []
        frame_indices = []

        for pose in poses:
            if not pose.detected:
                continue
            l_angle = self._get_joint_angle(pose.landmarks, joint_a, joint_b, joint_c, "left")
            r_angle = self._get_joint_angle(pose.landmarks, joint_a, joint_b, joint_c, "right")
            left_angles.append(l_angle)
            right_angles.append(r_angle)
            timestamps.append(pose.timestamp_ms / 1000.0)
            frame_indices.append(pose.frame_idx)

        left_angles = np.array(left_angles)
        right_angles = np.array(right_angles)
        avg_angles = (left_angles + right_angles) / 2
        timestamps = np.array(timestamps)

        return left_angles, right_angles, avg_angles, timestamps, frame_indices

    def _smooth_signal(self, signal: np.ndarray, window: int = 5) -> np.ndarray:
        """Simple moving average smoothing."""
        if len(signal) < window:
            return signal
        kernel = np.ones(window) / window
        # Pad to avoid edge effects
        padded = np.pad(signal, (window // 2, window // 2), mode='edge')
        smoothed = np.convolve(padded, kernel, mode='valid')
        return smoothed[:len(signal)]

    def _valley_prominence(self, smoothed: np.ndarray, valley_idx: int, left_peak: int, right_peak: int) -> float:
        """
        How much does a valley stand out relative to the peaks on both sides.
        Prominence = valley_angle relative to the lower of the two surrounding peaks.
        Higher prominence = more real. Noise and bounces have near-zero prominence.
        """
        valley_angle = smoothed[valley_idx]
        left_peak_angle = smoothed[left_peak] if left_peak < len(smoothed) else valley_angle
        right_peak_angle = smoothed[right_peak] if right_peak < len(smoothed) else valley_angle
        # Prominence is how far the valley dips below the lower surrounding peak
        return min(left_peak_angle, right_peak_angle) - valley_angle

    def _detect_reps(
        self,
        avg_angles: np.ndarray,
        left_angles: np.ndarray,
        right_angles: np.ndarray,
        timestamps: np.ndarray,
        exercise_type: str,
        frame_indices: list[int] = None,
        secondary_avg: np.ndarray = None,
    ) -> list[RepData]:
        
        params = self.EXERCISE_PARAMS.get(exercise_type, self.EXERCISE_PARAMS["squat"])
        if len(avg_angles) < 10:
            return []

        smoothed = self._smooth_signal(avg_angles, window=3)
        sec_smoothed = self._smooth_signal(secondary_avg, window=3) if secondary_avg is not None else None

        angle_range = np.max(smoothed) - np.min(smoothed)
        min_angle_range = params["min_angle_range"]
        if angle_range < min_angle_range:
            return []

        min_prominence = angle_range * 0.25

        # --- THE ZONE-BASED STATE MACHINE ---
        LOCKOUT_THRESHOLD = params["lockout_angle"]
        WORK_THRESHOLD = params["work_angle"]
        

        state = "locked_out"
        current_valley_idx = 0
        current_valley_val = 999
        
        last_lockout_peak_idx = 0 
        last_lockout_val = 0
        
        valleys = []
        peaks = []
        lockouts = [] # <--- Tracks the exact frame you stand up

        for i in range(len(smoothed)):
            angle = smoothed[i]

            if state == "locked_out":
                if angle > last_lockout_val:
                    last_lockout_val = angle
                    last_lockout_peak_idx = i

                if angle < WORK_THRESHOLD:
                    state = "in_the_hole"
                    current_valley_val = angle
                    current_valley_idx = i
                    peaks.append(last_lockout_peak_idx) 

            elif state == "in_the_hole":
                if angle < current_valley_val:
                    current_valley_val = angle
                    current_valley_idx = i

                if angle > LOCKOUT_THRESHOLD:
                    valleys.append(current_valley_idx)
                    lockouts.append(i) # <--- Record the exact frame the rep finishes!
                    
                    state = "locked_out"
                    last_lockout_val = angle
                    last_lockout_peak_idx = i

        if state == "in_the_hole":
            valleys.append(current_valley_idx)
            lockouts.append(len(smoothed) - 1)
            peaks.append(last_lockout_peak_idx)

        # --- Helper: map signal index → video frame index ---
        def to_frame(sig_idx: int) -> int:
            if frame_indices and 0 <= sig_idx < len(frame_indices):
                return frame_indices[sig_idx]
            return sig_idx  

        SEC_MIN_DIP = params["sec_min_dip"]

        # --- Build candidate reps ---
        candidates = []
        for idx, valley_idx in enumerate(valleys):
            prev_peak = next((p for p in reversed(peaks) if p < valley_idx), 0)
            
            # Grab the actual lockout frame we saved!
            actual_end_idx = lockouts[idx] if idx < len(lockouts) else len(smoothed) - 1
            
            # Use actual_end_idx for calculating prominence instead of the start of the next rep
            prominence = self._valley_prominence(smoothed, valley_idx, prev_peak, actual_end_idx)
            if prominence < min_prominence:
                continue

            sec_dip = None
            if sec_smoothed is not None:
                seg = sec_smoothed[max(0, prev_peak):min(len(sec_smoothed), actual_end_idx + 1)]
                if len(seg) >= 3:
                    sec_dip = float(np.max(seg) - np.min(seg))
                    if sec_dip < SEC_MIN_DIP:
                        continue  

            start_t = timestamps[prev_peak] if prev_peak < len(timestamps) else 0
            bottom_t = timestamps[valley_idx] if valley_idx < len(timestamps) else 0
            end_t = timestamps[actual_end_idx] if actual_end_idx < len(timestamps) else 0

            eccentric_dur = max(bottom_t - start_t, 0.01)
            concentric_dur = max(end_t - bottom_t, 0.01) # <--- Perfectly accurate time now

            seg_start = max(0, prev_peak)
            seg_end = min(len(left_angles), actual_end_idx + 1)
            if seg_end - seg_start >= 4:
                l_seg = left_angles[seg_start:seg_end]
                r_seg = right_angles[seg_start:seg_end]
                rep_rom_lr = max(np.max(l_seg) - np.min(l_seg), np.max(r_seg) - np.min(r_seg), 1.0)
                avg_diff = float(np.mean(np.abs(l_seg - r_seg)))
                symmetry = float(np.clip(1.0 - avg_diff / rep_rom_lr, 0.0, 1.0))
            else:
                symmetry = 0.8

            rep_segment = smoothed[seg_start:min(actual_end_idx + 1, len(smoothed))]
            if len(rep_segment) > 3:
                velocity = np.diff(rep_segment)
                acceleration = np.diff(velocity)
                jerk = np.std(acceleration) if len(acceleration) > 0 else 0
                smoothness = max(0, 1.0 - jerk / 5.0)
            else:
                smoothness = 0.5

            candidates.append(dict(
                valley_idx=valley_idx,
                prev_peak=prev_peak,
                next_peak=actual_end_idx, # <--- Triggers the frontend text flash perfectly
                start_t=start_t,
                bottom_t=bottom_t,
                end_t=end_t,
                eccentric_dur=eccentric_dur,
                concentric_dur=concentric_dur,
                symmetry=symmetry,
                smoothness=smoothness,
                prominence=prominence,
                sec_dip=sec_dip,
            ))

        if not candidates:
            return []

        # --- Failed rep detection ---
        concentric_times = [c["concentric_dur"] for c in candidates]
        eccentric_times = [c["eccentric_dur"] for c in candidates] # <--- Added this
        roms = [smoothed[c["prev_peak"]] - smoothed[c["valley_idx"]] for c in candidates]
        
        
        CONCENTRIC_THRESHOLD = params["concentric_fail_frac"]
        ECCENTRIC_THRESHOLD = params["eccentric_fail_frac"]
        ROM_THRESHOLD = params["rom_fail_frac"]

        reps = []
        rep_num = 0
        for i, cand in enumerate(candidates):
            neighbour_indices = [j for j in range(max(0, i - 3), min(len(candidates), i + 4)) if j != i]
            local_median_conc = float(np.median([concentric_times[j] for j in neighbour_indices])) if neighbour_indices else cand["concentric_dur"]
            # Calculate median eccentric speed to compare against
            local_median_ecc = float(np.median([eccentric_times[j] for j in neighbour_indices])) if neighbour_indices else cand["eccentric_dur"]

            rep_rom = roms[i]
            other_roms = [roms[j] for j in range(len(roms)) if j != i]
            loo_median_rom = float(np.median(other_roms)) if other_roms else rep_rom

            # Updated failure logic to catch drops
            is_failed = len(candidates) > 1 and (
                # 1. Bail: Stood up too fast
                (local_median_conc > 0 and cand["concentric_dur"] < local_median_conc * CONCENTRIC_THRESHOLD and cand["concentric_dur"] < 1.2)
                # 2. Drop: Fell too fast (Scales with your 3s eccentric!)
                or (local_median_ecc > 0 and cand["eccentric_dur"] < local_median_ecc * ECCENTRIC_THRESHOLD)
                # 3. Shallow: Quarter squat
                or (loo_median_rom > 0 and rep_rom < loo_median_rom * ROM_THRESHOLD)
            )

            rep_num += 1
            reps.append(RepData(
                rep_number=rep_num,
                start_frame=to_frame(cand["prev_peak"]),
                bottom_frame=to_frame(cand["valley_idx"]),
                end_frame=to_frame(cand["next_peak"]),
                start_time_s=round(cand["start_t"], 3),
                bottom_time_s=round(cand["bottom_t"], 3),
                end_time_s=round(cand["end_t"], 3),
                duration_s=round(cand["eccentric_dur"] + cand["concentric_dur"], 3),
                concentric_duration_s=round(cand["concentric_dur"], 3),
                eccentric_duration_s=round(cand["eccentric_dur"], 3),
                min_angle=round(float(smoothed[cand["valley_idx"]]), 1),
                max_angle=round(float(smoothed[cand["prev_peak"]]) if cand["prev_peak"] < len(smoothed) else 0, 1),
                range_of_motion=round(float(smoothed[cand["prev_peak"]] - smoothed[cand["valley_idx"]]) if cand["prev_peak"] < len(smoothed) else 0, 1),
                symmetry_score=round(cand["symmetry"], 3),
                smoothness_score=round(cand["smoothness"], 3),
                status="failed" if is_failed else "completed",
            ))

        return reps
        # --- Helper: map signal index → video frame index ---
        def to_frame(sig_idx: int) -> int:
            if frame_indices and 0 <= sig_idx < len(frame_indices):
                return frame_indices[sig_idx]
            return sig_idx  # fallback (shouldn't happen)

        # --- Secondary angle validation threshold ---
        # For squats the hip angle (shoulder-hip-knee) drops ~40-80° during a
        # real squat but barely changes during walking.  We require the
        # secondary angle to dip by at least 20° over the rep window.
        SEC_MIN_DIP = 20.0  # degrees

        # --- Build candidate reps ---
        candidates = []
        for valley_idx in valleys:
            prev_peak = next((p for p in reversed(peaks) if p < valley_idx), 0)
            next_peak = next((p for p in peaks if p > valley_idx), None)
            if next_peak is None:
                next_peak = min(valley_idx + (valley_idx - prev_peak), len(smoothed) - 1)

            prominence = self._valley_prominence(smoothed, valley_idx, prev_peak, next_peak)
            if prominence < min_prominence:
                continue

            # ---- Secondary angle gate ----
            # Reject candidates where the secondary joint doesn't also dip
            sec_dip = None
            if sec_smoothed is not None:
                seg = sec_smoothed[max(0, prev_peak):min(len(sec_smoothed), next_peak + 1)]
                if len(seg) >= 3:
                    sec_dip = float(np.max(seg) - np.min(seg))
                    if sec_dip < SEC_MIN_DIP:
                        t_v = timestamps[valley_idx] if valley_idx < len(timestamps) else 0
                        print(f"[DEBUG] REJECTED valley t={t_v:.1f}s  primary_val={smoothed[valley_idx]:.0f}  prom={prominence:.1f}  sec_dip={sec_dip:.1f} < {SEC_MIN_DIP}")
                        continue  # walking/setup — skip

            start_t = timestamps[prev_peak] if prev_peak < len(timestamps) else 0
            bottom_t = timestamps[valley_idx] if valley_idx < len(timestamps) else 0
            end_t = timestamps[next_peak] if next_peak < len(timestamps) else 0

            eccentric_dur = max(bottom_t - start_t, 0.01)
            concentric_dur = max(end_t - bottom_t, 0.01)

            # Symmetry: average absolute L/R angle difference over the rep,
            # normalised by ROM. 0 difference → 1.0 symmetry.
            seg_start = max(0, prev_peak)
            seg_end = min(len(left_angles), next_peak + 1)
            if seg_end - seg_start >= 4:
                l_seg = left_angles[seg_start:seg_end]
                r_seg = right_angles[seg_start:seg_end]
                rep_rom_lr = max(np.max(l_seg) - np.min(l_seg), np.max(r_seg) - np.min(r_seg), 1.0)
                avg_diff = float(np.mean(np.abs(l_seg - r_seg)))
                symmetry = float(np.clip(1.0 - avg_diff / rep_rom_lr, 0.0, 1.0))
            else:
                symmetry = 0.8

            rep_segment = smoothed[seg_start:min(next_peak + 1, len(smoothed))]
            if len(rep_segment) > 3:
                velocity = np.diff(rep_segment)
                acceleration = np.diff(velocity)
                jerk = np.std(acceleration) if len(acceleration) > 0 else 0
                smoothness = max(0, 1.0 - jerk / 5.0)
            else:
                smoothness = 0.5

            candidates.append(dict(
                valley_idx=valley_idx,
                prev_peak=prev_peak,
                next_peak=next_peak,
                start_t=start_t,
                bottom_t=bottom_t,
                end_t=end_t,
                eccentric_dur=eccentric_dur,
                concentric_dur=concentric_dur,
                symmetry=symmetry,
                smoothness=smoothness,
                prominence=prominence,
                sec_dip=sec_dip,
            ))

        # Debug: show accepted candidates
        for c in candidates:
            t_v = timestamps[c["valley_idx"]]
            print(f"[DEBUG] ACCEPTED valley t={t_v:.1f}s  primary_val={smoothed[c['valley_idx']]:.0f}  prom={c['prominence']:.1f}  sec_dip={c.get('sec_dip', 'N/A')}")
        print(f"[DEBUG] {len(candidates)} total candidates")

        if not candidates:
            return []

        # --- Failed rep detection ---
        # Two signals: concentric too fast OR ROM too shallow vs set median
        concentric_times = [c["concentric_dur"] for c in candidates]
        roms = [smoothed[c["prev_peak"]] - smoothed[c["valley_idx"]] for c in candidates]
        CONCENTRIC_THRESHOLD = 0.40
        ROM_THRESHOLD = 0.55

        reps = []
        rep_num = 0
        for i, cand in enumerate(candidates):
            neighbour_indices = [j for j in range(max(0, i - 3), min(len(candidates), i + 4)) if j != i]
            local_median_conc = float(np.median([concentric_times[j] for j in neighbour_indices])) if neighbour_indices else cand["concentric_dur"]

            rep_rom = roms[i]
            other_roms = [roms[j] for j in range(len(roms)) if j != i]
            loo_median_rom = float(np.median(other_roms)) if other_roms else rep_rom

            is_failed = len(candidates) > 1 and (
                (local_median_conc > 0 and cand["concentric_dur"] < local_median_conc * CONCENTRIC_THRESHOLD)
                or (loo_median_rom > 0 and rep_rom < loo_median_rom * ROM_THRESHOLD)
            )

            rep_num += 1
            reps.append(RepData(
                rep_number=rep_num,
                start_frame=to_frame(cand["prev_peak"]),
                bottom_frame=to_frame(cand["valley_idx"]),
                end_frame=to_frame(cand["next_peak"]),
                start_time_s=round(cand["start_t"], 3),
                bottom_time_s=round(cand["bottom_t"], 3),
                end_time_s=round(cand["end_t"], 3),
                duration_s=round(cand["eccentric_dur"] + cand["concentric_dur"], 3),
                concentric_duration_s=round(cand["concentric_dur"], 3),
                eccentric_duration_s=round(cand["eccentric_dur"], 3),
                min_angle=round(float(smoothed[cand["valley_idx"]]), 1),
                max_angle=round(float(smoothed[cand["prev_peak"]]) if cand["prev_peak"] < len(smoothed) else 0, 1),
                range_of_motion=round(
                    float(smoothed[cand["prev_peak"]] - smoothed[cand["valley_idx"]])
                    if cand["prev_peak"] < len(smoothed) else 0, 1
                ),
                symmetry_score=round(cand["symmetry"], 3),
                smoothness_score=round(cand["smoothness"], 3),
                status="failed" if is_failed else "completed",
            ))

        return reps

    def _assign_per_rep_rpe(self, reps: list[RepData]) -> list[RepData]:
        """
        Assign per-rep RPE using failure-anchored scaling.

        If a failed rep exists:
          - Last completed rep before the fail = RPE 9 (by definition: had one
            more in the tank but the next one didn't go)
          - All other completed reps are scaled relative to that anchor using
            their concentric duration ratio — person-agnostic, no hardcoded speeds
          - Failed reps = RPE 10

        If no failed rep:
          - Fit a linear trend to concentric durations across the set
          - Extrapolate where the curve would reach the "failure threshold"
            (defined as 2x the first rep's concentric duration — a rep taking
            twice as long as your opener is essentially a grinder/fail)
          - Use proximity to that extrapolated failure point to set the last
            rep's RPE, then scale all earlier reps relative to it
        """
        good_reps = [r for r in reps if r.status == "completed"]
        if not good_reps:
            for r in reps:
                r.rpe = 10.0 if r.status == "failed" else 5.0
            return reps

        if len(good_reps) == 1:
            good_reps[0].rpe = 7.0
            for r in reps:
                if r.status == "failed":
                    r.rpe = 10.0
            return reps

        has_failure = any(r.status == "failed" for r in reps)
        concentric_times = [r.concentric_duration_s for r in good_reps]

        if has_failure:
            # Anchor: last completed rep = RPE 9
            anchor_concentric = concentric_times[-1]
            anchor_rpe = 9.0
        else:
            # No failure: extrapolate the trend to estimate how close they were
            x = np.arange(len(concentric_times), dtype=float)
            slope, intercept = np.polyfit(x, concentric_times, 1)

            # "Failure threshold" = 2x the first rep's concentric time
            # (empirically, a rep taking 2x your opener = grinding fail territory)
            failure_threshold = concentric_times[0] * 2.0

            if slope > 0:  # getting slower — extrapolate to failure
                # How many more reps until the trend hits failure threshold?
                reps_to_failure = (failure_threshold - intercept) / slope - (len(concentric_times) - 1)
                reps_to_failure = max(reps_to_failure, 0)
                # Closer to failure = higher RPE for the last rep
                # 0 reps away = RPE 9, 3+ reps away = RPE 6
                last_rpe = np.clip(9.0 - reps_to_failure, 5.0, 9.0)
            else:
                # Flat or getting faster — they had plenty left
                last_rpe = 6.0

            anchor_concentric = concentric_times[-1]
            anchor_rpe = float(last_rpe)

        # Scale all completed reps relative to the anchor.
        # Ratio < 1 means faster than anchor = lower RPE.
        # Each halving of concentric time relative to anchor = -3 RPE points (log scale).
        for i, rep in enumerate(good_reps):
            if anchor_concentric > 0:
                ratio = rep.concentric_duration_s / anchor_concentric
                # log2(ratio): 0 at anchor, negative when faster, positive when slower
                rpe_offset = np.log2(ratio) * 3.0
            else:
                rpe_offset = 0.0
            rep.rpe = round(float(np.clip(anchor_rpe + rpe_offset, 1.0, 9.0)), 1)

        for r in reps:
            if r.status == "failed":
                r.rpe = 10.0

        return reps

    def _estimate_rpe(self, reps: list[RepData]) -> float:
        """
        Set-level RPE: weighted average of per-rep RPEs, skewed toward later reps.
        If any failed rep exists, floor is 9.0 (you don't fail at RPE 8).
        """
        if not reps:
            return 5.0

        has_failure = any(r.status == "failed" for r in reps)
        rpe_values = [r.rpe for r in reps if r.rpe > 0]

        if not rpe_values:
            return 9.0 if has_failure else 5.0

        # Weight later reps more heavily — they reflect accumulated fatigue
        weights = np.linspace(0.5, 1.5, len(rpe_values))
        set_rpe = float(np.average(rpe_values, weights=weights))

        if has_failure:
            set_rpe = max(set_rpe, 9.0)

        return round(np.clip(set_rpe, 1.0, 10.0), 1)

    def _calculate_fatigue_index(self, reps: list[RepData]) -> float:
        """
        Fatigue index [0-1]: measures how much performance degraded across the set.
        Uses concentric slowing (the effort phase) as the primary signal — it's the
        most direct indicator of muscular fatigue and isn't inflated by intentional
        eccentric control or rest time.

        Secondary signal: smoothness degradation.
        ROM is intentionally excluded — slight ROM variation is normal and doesn't
        reliably track fatigue.
        """
        good_reps = [r for r in reps if r.status == "completed"]
        if len(good_reps) < 2:
            return 0.0

        conc_times = [r.concentric_duration_s for r in good_reps]

        # Fit a linear trend to concentric times across the set.
        # The slope tells us how much each rep slows on average.
        x = np.arange(len(conc_times), dtype=float)
        slope, intercept = np.polyfit(x, conc_times, 1)

        # Normalise: total predicted slowdown from rep 1 to rep N,
        # expressed as a fraction of the first rep's concentric time.
        # e.g. first=1.5s, last predicted=2.1s → slowdown = 0.6/1.5 = 0.40
        predicted_first = intercept
        predicted_last = intercept + slope * (len(conc_times) - 1)
        if predicted_first > 0 and slope > 0:
            conc_fatigue = (predicted_last - predicted_first) / predicted_first
        else:
            # Flat or getting faster — use raw first-vs-last as fallback
            conc_fatigue = max(0, (conc_times[-1] - conc_times[0]) / max(conc_times[0], 0.01))

        # Cap at 1.0: doubling of concentric time = 100% fatigue index
        conc_fatigue = float(np.clip(conc_fatigue, 0, 1.0))

        # Smoothness degradation (secondary, 20% weight)
        smooth_fatigue = max(0.0, good_reps[0].smoothness_score - good_reps[-1].smoothness_score)

        fatigue = conc_fatigue * 0.80 + smooth_fatigue * 0.20
        return round(float(np.clip(fatigue, 0, 1)), 3)

    def _calculate_technique_score(self, reps: list[RepData], exercise_type: str) -> tuple[float, list[str]]:
        """
        Technique score [0-100] based on ROM consistency, symmetry, smoothness.
        Returns (score, notes).
        """
        notes = []
        if len(reps) == 0:
            return 50.0, ["No reps detected to analyze technique"]

        roms = [r.range_of_motion for r in reps]
        symmetries = [r.symmetry_score for r in reps]
        smoothness_scores = [r.smoothness_score for r in reps]

        # ROM consistency (coefficient of variation)
        rom_mean = np.mean(roms)
        rom_std = np.std(roms)
        rom_cv = rom_std / max(rom_mean, 1) if rom_mean > 0 else 0
        rom_consistency = max(0, 1.0 - rom_cv * 2)

        # Average symmetry
        avg_symmetry = np.mean(symmetries)

        # Average smoothness
        avg_smoothness = np.mean(smoothness_scores)

        # ROM adequacy (exercise-specific)
        rom_adequate = 1.0
        if exercise_type == "squat":
            if rom_mean < 50:
                rom_adequate = 0.7
                notes.append("Squat depth could be deeper (limited range of motion)")
            elif rom_mean < 35:
                rom_adequate = 0.5
                notes.append("Very shallow squat depth - aim for parallel or below")
        elif exercise_type == "bench_press":
            if rom_mean < 40:
                rom_adequate = 0.7
                notes.append("Partial range of motion on bench press")
        elif exercise_type == "deadlift":
            if rom_mean < 40:
                rom_adequate = 0.7
                notes.append("Limited hip hinge range - check form")

        # Symmetry notes
        if avg_symmetry < 0.80:
            notes.append(f"Left/right asymmetry detected ({avg_symmetry:.0%} symmetry) — possible muscle imbalance")
        if avg_symmetry < 0.60:
            notes.append("Significant L/R asymmetry — check for injury compensation or uneven loading")

        # Smoothness notes
        if avg_smoothness < 0.5:
            notes.append("Jerky/unstable movement detected - focus on controlled tempo")

        # Fatigue-related technique breakdown
        if len(reps) >= 3:
            first_third_smooth = np.mean([r.smoothness_score for r in reps[:len(reps) // 3 + 1]])
            last_third_smooth = np.mean([r.smoothness_score for r in reps[-(len(reps) // 3 + 1):]])
            if first_third_smooth - last_third_smooth > 0.2:
                notes.append("Technique degrades in later reps - consider reducing weight or reps")

        # Composite score
        score = (
            rom_consistency * 25 +
            avg_symmetry * 25 +
            avg_smoothness * 25 +
            rom_adequate * 25
        )

        if not notes:
            notes.append("Good overall technique consistency")

        return round(float(score), 1), notes

    def analyze(self, poses: list[FramePose], exercise_type: str, exercise_confidence: float, fps: float = 30.0) -> AnalysisResult:
        """
        Full analysis of a set of poses for a given exercise type.
        """
        if exercise_type not in self.EXERCISE_ANGLES:
            exercise_type_key = "squat"  # fallback
        else:
            exercise_type_key = exercise_type

        angles_config = self.EXERCISE_ANGLES[exercise_type_key]
        joint_a, joint_b, joint_c = angles_config["primary"]
        sec_a, sec_b, sec_c = angles_config["secondary"]

        # Extract primary angle series
        left_angles, right_angles, avg_angles, timestamps, frame_indices = self._extract_angle_series(
            poses, joint_a, joint_b, joint_c
        )

        # Extract secondary angle series (for two-angle validation)
        secondary_avg = None
        if (sec_a, sec_b, sec_c) != (joint_a, joint_b, joint_c):
            _, _, secondary_avg, _, _ = self._extract_angle_series(
                poses, sec_a, sec_b, sec_c
            )

        if len(avg_angles) < 5:
            return AnalysisResult(
                exercise_type=exercise_type,
                exercise_confidence=exercise_confidence,
                total_reps=0,
                reps=[],
                avg_rep_duration_s=0,
                avg_rom=0,
                technique_score=0,
                estimated_rpe=0,
                fatigue_index=0,
                symmetry_avg=0,
                notes=["Insufficient pose data detected in video"],
                angle_curves={
                    "primary_joint": f"{joint_a}-{joint_b}-{joint_c}",
                    "avg_angles": avg_angles.tolist(),
                    "left_angles": left_angles.tolist(),
                    "right_angles": right_angles.tolist(),
                    "timestamps": timestamps.tolist(),
                },
            )

        # Detect reps (with frame mapping + secondary angle validation)
        reps = self._detect_reps(
            avg_angles, left_angles, right_angles, timestamps, exercise_type,
            frame_indices=frame_indices, secondary_avg=secondary_avg,
        )

        # Assign per-rep RPE before computing set-level metrics
        reps = self._assign_per_rep_rpe(reps)

        # Compute metrics — only over completed reps for accuracy
        good_reps = [r for r in reps if r.status == "completed"]
        failed_count = len(reps) - len(good_reps)

        if good_reps:
            avg_duration = np.mean([r.duration_s for r in good_reps])
            avg_rom = np.mean([r.range_of_motion for r in good_reps])
            symmetry_avg = np.mean([r.symmetry_score for r in good_reps])
        else:
            avg_duration = 0
            avg_rom = 0
            symmetry_avg = 0

        rpe = self._estimate_rpe(reps)
        fatigue = self._calculate_fatigue_index(reps)
        technique_score, notes = self._calculate_technique_score(good_reps, exercise_type)

        if failed_count > 0:
            notes.append(f"{failed_count} failed rep(s) detected (abnormally fast concentric — likely a bail or standup after failure)")

        return AnalysisResult(
            exercise_type=exercise_type,
            exercise_confidence=exercise_confidence,
            total_reps=len(good_reps),  # only count completed reps
            reps=reps,
            avg_rep_duration_s=round(avg_duration, 3),
            avg_rom=round(avg_rom, 1),
            technique_score=technique_score,
            estimated_rpe=rpe,
            fatigue_index=fatigue,
            symmetry_avg=round(symmetry_avg, 3),
            notes=notes,
            angle_curves={
                "primary_joint": f"{joint_a}-{joint_b}-{joint_c}",
                "avg_angles": avg_angles.tolist(),
                "left_angles": left_angles.tolist(),
                "right_angles": right_angles.tolist(),
                "timestamps": timestamps.tolist(),
            },
        )
