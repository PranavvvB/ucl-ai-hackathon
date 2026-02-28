import Link from "next/link";
import { Dumbbell } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-6"
      style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <Dumbbell className="w-16 h-16 text-[#3b82f6] mb-6" />
      <h1 className="text-8xl font-black text-[#3b82f6] mb-2">404</h1>
      <h2 className="text-2xl font-black mb-3">Page Not Found</h2>
      <p className="mb-8 text-base max-w-sm" style={{ color: "var(--muted)" }}>
        Looks like you missed your lift. This page does not exist.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 px-8 py-4 bg-[#3b82f6] text-black font-black rounded-xl text-lg hover:bg-[#2563eb] transition-all duration-200 active:scale-95"
      >
        Return to Dashboard
      </Link>
    </main>
  );
}
