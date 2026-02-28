import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Zap } from "lucide-react";

export interface TrendSession {
  score: number;
  corrections: string[];
  lift_type: string;
  created_at: string;
}

export interface LiftTrend {
  liftType: string;
  sessions: TrendSession[];
  slope: number;
  avgScore: number;
  topCorrections: { text: string; count: number }[];
}

function olsSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function canonicalKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim().slice(0, 60);
}

export function computeTrends(sessions: TrendSession[]): LiftTrend[] {
  const byLift: Record<string, TrendSession[]> = {};
  for (const s of sessions) {
    if (!byLift[s.lift_type]) byLift[s.lift_type] = [];
    byLift[s.lift_type].push(s);
  }

  return Object.entries(byLift).map(([liftType, rows]) => {
    const sorted = [...rows].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const scores = sorted.map((r) => r.score);
    const slope = olsSlope(scores);
    const avgScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);

    const freq: Record<string, { text: string; count: number }> = {};
    for (const row of sorted) {
      const seen = new Set<string>();
      for (const c of row.corrections) {
        const key = canonicalKey(c);
        if (seen.has(key)) continue;
        seen.add(key);
        if (!freq[key]) freq[key] = { text: c, count: 0 };
        freq[key].count++;
      }
    }

    const topCorrections = Object.values(freq)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return { liftType, sessions: sorted, slope, avgScore, topCorrections };
  });
}

// ---- SVG line graph ----

const W = 300;
const H = 72;
const PAD = 8;

function LineGraph({ scores, color }: { scores: number[]; color: string }) {
  if (scores.length < 2) return null;

  const minS = Math.min(...scores);
  const maxS = Math.max(...scores);
  const range = maxS - minS || 1;

  const pts = scores.map((s, i) => {
    const x = PAD + (i / (scores.length - 1)) * (W - PAD * 2);
    const y = PAD + (1 - (s - minS) / range) * (H - PAD * 2);
    return [x, y] as [number, number];
  });

  const polyline = pts.map(([x, y]) => `${x},${y}`).join(" ");

  // OLS regression line endpoints
  const meanX = (scores.length - 1) / 2;
  const meanY = scores.reduce((a, b) => a + b, 0) / scores.length;
  const slope = olsSlope(scores);
  const regY = (i: number) => meanY + slope * (i - meanX);
  const ry0 = PAD + (1 - (regY(0) - minS) / range) * (H - PAD * 2);
  const ryN = PAD + (1 - (regY(scores.length - 1) - minS) / range) * (H - PAD * 2);

  // Area fill under line
  const areaPoints = [
    `${pts[0][0]},${H}`,
    ...pts.map(([x, y]) => `${x},${y}`),
    `${pts[pts.length - 1][0]},${H}`,
  ].join(" ");

  const dotLast = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`fill-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area */}
      <polygon
        points={areaPoints}
        fill={`url(#fill-${color.replace("#", "")})`}
      />

      {/* Actual score line */}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* OLS regression line */}
      <line
        x1={PAD} y1={ry0}
        x2={W - PAD} y2={ryN}
        stroke={color}
        strokeWidth="1"
        strokeDasharray="4 3"
        strokeOpacity="0.45"
      />

      {/* Score dots */}
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill={color} opacity="0.6" />
      ))}

      {/* Last dot highlighted */}
      <circle cx={dotLast[0]} cy={dotLast[1]} r="4" fill={color} />
      <circle cx={dotLast[0]} cy={dotLast[1]} r="4" fill="none" stroke={color} strokeWidth="2" opacity="0.3" />
    </svg>
  );
}

// ---- Main component ----

interface TrendInsightProps {
  trends: LiftTrend[];
}

function slopeLabel(slope: number, n: number) {
  if (n < 2) return { label: "Not enough data", icon: Minus, color: "var(--muted)" };
  if (slope > 1.5) return { label: `+${slope.toFixed(1)} pts/session`, icon: TrendingUp, color: "#3b82f6" };
  if (slope < -1.5) return { label: `${slope.toFixed(1)} pts/session`, icon: TrendingDown, color: "#ff2d2d" };
  return { label: "Holding steady", icon: Minus, color: "#f59e0b" };
}

function scoreColor(score: number) {
  if (score >= 80) return "#3b82f6";
  if (score >= 60) return "#f59e0b";
  return "#ff2d2d";
}

export function TrendInsight({ trends }: TrendInsightProps) {
  if (trends.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: "var(--muted)" }}>
        Form Trend Analysis
      </h2>

      <div className="flex flex-col gap-4">
        {trends.map((t) => {
          const { label, icon: Icon, color } = slopeLabel(t.slope, t.sessions.length);
          const hasRecurring = t.topCorrections.some((c) => c.count > 1);
          const lineColor = color === "var(--muted)" ? "#3b82f6" : color;

          return (
            <div
              key={t.liftType}
              className="rounded-2xl border overflow-hidden"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-5 py-4 border-b"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
              >
                <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-[#3b82f6]" />
                  <span className="font-black uppercase tracking-wide text-sm" style={{ color: "var(--foreground)" }}>
                    {t.liftType.replace(/-/g, " ")}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                    {t.sessions.length} session{t.sessions.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-black" style={{ color: scoreColor(t.avgScore) }}>{t.avgScore}</span>
                  <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--muted)" }}>avg</span>
                </div>
              </div>

              <div className="px-5 pt-4 pb-5 space-y-4">
                {/* Trend badge */}
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 shrink-0" style={{ color }} />
                  <span className="text-sm font-bold" style={{ color }}>{label}</span>
                  {t.sessions.length >= 2 && (
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      &mdash; {t.sessions.length} sessions
                    </span>
                  )}
                </div>

                {/* Line graph */}
                {t.sessions.length >= 2 && (
                  <div className="rounded-xl px-3 pt-3 pb-2" style={{ background: "var(--surface-2)" }}>
                    <LineGraph scores={t.sessions.map((s) => s.score)} color={lineColor} />
                    <div className="flex justify-between mt-1 text-[10px]" style={{ color: "var(--muted)" }}>
                      <span>Session 1</span>
                      <span className="opacity-50 text-[9px]">---- trend</span>
                      <span>Latest</span>
                    </div>
                  </div>
                )}

                {/* Recurring corrections */}
                {hasRecurring ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b]" />
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                        Recurring issues — keep working on these
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {t.topCorrections.filter((c) => c.count > 1).map((c) => (
                        <li key={c.text} className="flex items-start gap-2 text-sm">
                          <span
                            className="shrink-0 text-xs font-black px-1.5 py-0.5 rounded mt-0.5"
                            style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
                          >
                            {c.count}x
                          </span>
                          <span style={{ color: "var(--foreground)" }}>{c.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : t.sessions.length >= 2 ? (
                  <div className="flex items-center gap-2 text-sm text-[#3b82f6]">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    No recurring corrections — great consistency!
                  </div>
                ) : null}

                {/* Coaching verdict */}
                <p className="text-xs leading-relaxed border-t pt-3" style={{ color: "var(--muted)", borderColor: "var(--border)" }}>
                  {coachVerdict(t)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function coachVerdict(t: LiftTrend): string {
  const { slope, avgScore, sessions, topCorrections } = t;
  const n = sessions.length;
  const worstFix = topCorrections[0];
  const lift = t.liftType.replace(/-/g, " ");

  if (n < 2) return "Upload more sessions to unlock trend analysis and personalised coaching advice.";
  if (slope > 2) return `Your ${lift} is improving fast — keep the momentum. ${worstFix ? `Continue to address "${worstFix.text.toLowerCase()}" and you will break through to the next level.` : ""}`;
  if (slope > 0.5) return `Steady progress on ${lift}. ${worstFix ? `The most impactful thing you can do right now is drill "${worstFix.text.toLowerCase()}" — it is showing up across your sessions.` : "Keep consistent and the score will climb."}`;
  if (slope < -1.5) {
    if (avgScore < 65) return `Your ${lift} score has been declining. ${worstFix ? `Focus on one cue at a time — start with "${worstFix.text.toLowerCase()}". Drilling this in warm-up sets before adding load will accelerate recovery.` : "Consider dropping intensity and rebuilding technique from lighter weights."}`;
    return `${lift.charAt(0).toUpperCase() + lift.slice(1)} score is dipping slightly. ${worstFix ? `"${worstFix.text}" keeps appearing — make this your single focus next session.` : "Review your recent footage to spot the pattern."}`;
  }
  return `Your ${lift} score is plateauing around ${avgScore}. ${worstFix && worstFix.count > 1 ? `The recurring cue "${worstFix.text.toLowerCase()}" is the most likely ceiling — targeted accessory work on this specific weakness should break the plateau.` : "Add variation or film from a new angle to catch any technique leaks you might be missing."}`;
}