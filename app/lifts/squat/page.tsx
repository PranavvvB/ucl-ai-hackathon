import { LiftPage } from "@/components/LiftPage";

export const metadata = { title: "Squat Analysis  PowerAI" };

export default function SquatPage() {
  return (
    <LiftPage
      liftType="squat"
      title="Squat"
      description="Upload your squat video. Our AI will analyze your depth, bar path, knee tracking, and hip drive."
    />
  );
}
