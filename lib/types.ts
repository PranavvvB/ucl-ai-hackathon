export type LiftType = "squat" | "bench-press" | "deadlift";

export interface LiftSession {
  id: string;
  user_id: string;
  lift_type: LiftType;
  video_url: string;
  score: number;
  pros: string[];
  corrections: string[];
  created_at: string;
}
