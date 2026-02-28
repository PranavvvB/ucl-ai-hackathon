import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Dumbbell, Zap, Shield, TrendingUp, ChevronRight } from "lucide-react";
import { Navbar } from "@/components/Navbar";

const lifts = [
  { name: "Squat", href: "/lifts/squat" },
  { name: "Bench Press", href: "/lifts/bench-press" },
  { name: "Deadlift", href: "/lifts/deadlift" },
];

const features = [
  { icon: Zap, title: "Instant AI Feedback", desc: "Upload your lift video and get a detailed form score in seconds." },
  { icon: Shield, title: "Injury Prevention", desc: "Catch dangerous form errors before they become chronic injuries." },
  { icon: TrendingUp, title: "Track Progress", desc: "Review your history and watch your form score climb over time." },
];

export default async function HomePage() {
  const { userId } = await auth();
  const ctaHref = userId ? "/dashboard" : "/sign-up";
  const ctaLabel = userId ? "Go to Dashboard" : "Start Training Free";

  return (
    <main className="min-h-screen w-full overflow-x-hidden" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <Navbar />

      <section className="relative flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-28 pb-20 min-h-screen">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-[#3b82f6] opacity-[0.04] rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full border text-xs sm:text-sm font-semibold text-[#3b82f6] w-fit mx-auto"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
          <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          AI-Powered Form Analysis
        </div>

        <h1 className="text-4xl sm:text-7xl font-black leading-none tracking-tight mb-6">
          LIFT<br />
          <span className="text-[#3b82f6]" style={{ textShadow: "0 0 40px #3b82f660" }}>SMARTER.</span>
          <br />
          <span className="text-[#ff2d2d]" style={{ textShadow: "0 0 40px #ff2d2d60" }}>HARDER.</span>
        </h1>

        <p className="max-w-sm sm:max-w-md text-base sm:text-lg mb-10 leading-relaxed px-2" style={{ color: "var(--muted)" }}>
          Upload your squat, bench, or deadlift video. Our AI coach breaks down your form, scores your technique, and tells you exactly what to fix.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-none sm:w-auto">
          <Link
            href={ctaHref}
            className="flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-[#3b82f6] text-black font-black rounded-xl text-base sm:text-lg hover:shadow-[0_0_30px_#3b82f680] hover:bg-[#2563eb] transition-all duration-200 active:scale-95 min-h-[52px]"
          >
            {ctaLabel}
            <ChevronRight className="w-5 h-5" />
          </Link>
          {!userId && (
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 font-bold rounded-xl text-base sm:text-lg border transition-all duration-200 active:scale-95 min-h-[52px]"
              style={{ color: "var(--foreground)", borderColor: "var(--border)", background: "transparent" }}
            >
              Sign In
            </Link>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-12 w-full max-w-xs sm:max-w-xl">
          {lifts.map((lift) => (
            <Link
              key={lift.href}
              href={lift.href}
              className="flex-1 flex flex-col items-center gap-2 py-4 sm:py-6 px-4 rounded-2xl border hover:border-[#3b82f6] group transition-all duration-200 active:scale-95"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <span className="font-black text-sm uppercase tracking-widest group-hover:text-[#3b82f6] transition-colors">{lift.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="px-4 sm:px-6 py-20 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl sm:text-4xl font-black text-center mb-10 sm:mb-12 uppercase tracking-tight">
          Why <span className="text-[#3b82f6]">PowerAI</span>?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="p-5 sm:p-6 rounded-2xl border hover:border-[#3b82f6] transition-all duration-200 group"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-[#3b82f615] transition-colors"
                  style={{ background: "var(--surface-2)" }}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-[#3b82f6]" />
                </div>
                <h3 className="font-black text-base sm:text-lg mb-2">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="px-4 sm:px-6 py-16 max-w-3xl mx-auto text-center w-full">
        <div className="rounded-3xl border border-[#3b82f6] p-6 sm:p-10 relative overflow-hidden"
          style={{ background: "var(--surface)" }}>
          <div className="absolute inset-0 bg-[#3b82f6] opacity-[0.03] pointer-events-none" />
          <Dumbbell className="w-10 h-10 sm:w-12 sm:h-12 text-[#3b82f6] mx-auto mb-4" />
          <h2 className="text-2xl sm:text-3xl font-black mb-3">Ready to level up?</h2>
          <p className="mb-6 sm:mb-8 text-sm sm:text-base" style={{ color: "var(--muted)" }}>Join thousands of athletes getting stronger, safer.</p>
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 px-6 sm:px-10 py-3.5 sm:py-4 bg-[#3b82f6] text-black font-black rounded-xl text-base sm:text-lg hover:shadow-[0_0_30px_#3b82f680] hover:bg-[#2563eb] transition-all duration-200 active:scale-95 min-h-[52px]"
          >
            {userId ? "Go to Dashboard" : "Get Started - It is Free"}
          </Link>
        </div>
      </section>

      <footer className="border-t py-6 sm:py-8 text-center text-xs sm:text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
        <p>2026 PowerAI - Built for athletes, by athletes.</p>
      </footer>
    </main>
  );
}