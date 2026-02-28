import { LiftPage } from "@/components/LiftPage";

export const metadata = { title: "Bench Press Analysis  PowerAI" };

export default function BenchPressPage() {
  return (
    <LiftPage
      liftType="bench-press"
      title="Bench Press"
      description="Upload your bench press video. AI will check your arch, bar path, elbow tuck, and lockout."
    />
  );
}
