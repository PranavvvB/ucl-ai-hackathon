import { LiftPage } from "@/components/LiftPage";

export const metadata = { title: "Deadlift Analysis  PowerAI" };

export default function DeadliftPage() {
  return (
    <LiftPage
      liftType="deadlift"
      title="Deadlift"
      description="Upload your deadlift video. AI will review your hinge pattern, bar path, lockout, and back angle."
    />
  );
}
