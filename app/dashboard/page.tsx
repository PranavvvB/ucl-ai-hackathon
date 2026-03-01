import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Navbar } from "@/components/Navbar";
import { TrendInsight, computeTrends, TrendSession } from "@/components/TrendInsight";
import { Dumbbell, ChevronRight, Video, TrendingUp, Clock } from "lucide-react";
import pool from "@/lib/db";

function scoreColor(score: number) {
  if (score >= 80) return "#3b82f6";
  if (score >= 60) return "#f59e0b";
  return "#ff2d2d";
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type SessionRow = {
  id: string;
  lift_type: string;
  video_url: string;
  score: number;
  pros: string;
  corrections: string;
  created_at: string;
};

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const user = await currentUser();

  const [rows] = await pool.execute(
    `SELECT id, lift_type, video_url, score, pros, corrections, created_at
     FROM lift_sessions WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 50`,
    [userId]
  ) as [SessionRow[], unknown];

  const sessions = rows.map((r) => ({
    ...r,
    pros:        typeof r.pros        === "string" ? JSON.parse(r.pros)        : r.pros,
    corrections: typeof r.corrections === "string" ? JSON.parse(r.corrections) : r.corrections,
  }));

  const avgScore = sessions.length
    ? Math.round(sessions.reduce((sum, s) => sum + s.score, 0) / sessions.length)
    : null;

  const liftCount = new Set(sessions.map((s) => s.lift_type)).size;

  const trends = computeTrends(sessions as TrendSession[]);

  const recentSessions = sessions.slice(0, 10);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <Navbar />
      <main className="pt-20 px-4 pb-16 max-w-4xl mx-auto">
        <div className="py-8">
          <p className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: "var(--muted)" }}>Welcome back</p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color: "var(--foreground)" }}>
            Your <span className="text-[#3b82f6]">Dashboard</span>
          </h1>
          <p className="mt-1 text-sm truncate" style={{ color: "var(--muted)" }}>
            {user?.emailAddresses?.[0]?.emailAddress ?? ""}
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: "Sessions", value: sessions.length.toString(), icon: Video },
            { label: "Avg Score", value: avgScore !== null ? `${avgScore}` : "--", icon: TrendingUp },
            { label: "Lifts", value: liftCount > 0 ? liftCount.toString() : "0", icon: Dumbbell },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-xl p-3 sm:p-4 text-center border"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--foreground)" }}>
                <Icon className="w-5 h-5 text-[#3b82f6] mx-auto mb-1" />
                <div className="text-xl sm:text-2xl font-black">{stat.value}</div>
                <div className="text-[10px] uppercase tracking-widest font-semibold mt-0.5" style={{ color: "var(--muted)" }}>{stat.label}</div>
              </div>
            );
          })}
        </div>

        {/* Trend analysis */}
        {trends.length > 0 && <TrendInsight trends={trends} />}

        {/* Analyze lift CTA */}
        <h2 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: "var(--muted)" }}>Analyze a Lift</h2>
        <Link
          href="/lifts"
          className="flex items-center gap-5 p-5 rounded-2xl border hover:border-[#3b82f6] group transition-all duration-200 active:scale-[0.99] mb-12"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex-1 min-w-0">
            <div className="font-black text-lg uppercase tracking-tight group-hover:text-[#3b82f6] transition-colors" style={{ color: "var(--foreground)" }}>Upload & Analyze</div>
            <div className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>Squat, bench press, or deadlift — get instant AI form feedback.</div>
          </div>
          <ChevronRight className="w-5 h-5 group-hover:text-[#3b82f6] group-hover:translate-x-1 transition-all shrink-0" style={{ color: "var(--muted)" }} />
        </Link>

        {/* Recent sessions */}
        <h2 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: "var(--muted)" }}>Recent Sessions</h2>
        {recentSessions.length === 0 ? (
          <div className="rounded-2xl p-12 text-center border"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <Video className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--border)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--muted)" }}>No sessions yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Upload your first lift to see your history here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {recentSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center gap-4 p-4 rounded-xl border"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-black uppercase text-sm tracking-tight" style={{ color: "var(--foreground)" }}>
                    {session.lift_type.replace(/-/g, " ")}
                  </div>
                  <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                    <Clock className="w-3 h-3" />
                    {timeAgo(session.created_at)}
                  </div>
                </div>
                <div className="text-2xl font-black" style={{ color: scoreColor(session.score) }}>
                  {session.score}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
