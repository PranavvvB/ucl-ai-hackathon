"use client";
import { CheckCircle, AlertTriangle, Zap, RotateCcw, Gauge, Copy, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

export interface LiftFeedback {
  reps: number;
  rpe: number;
  advice: string;
  score: number;
  pros: string[];
  corrections: string[];
  liftType: string;
}

interface FeedbackCardProps {
  feedback: LiftFeedback;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (score / 100) * circumference;
  const color = score >= 80 ? "#3b82f6" : score >= 60 ? "#f59e0b" : "#ff2d2d";

  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="128" height="128">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <motion.circle
          cx="64" cy="64" r={radius} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - strokeDash }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="text-center z-10">
        <motion.span
          className="block text-3xl font-black"
          style={{ color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score}
        </motion.span>
        <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--muted)" }}>
          / 100
        </span>
      </div>
    </div>
  );
}

function RpeBar({ rpe }: { rpe: number }) {
  const pct = (rpe / 10) * 100;
  const color = rpe <= 5 ? "#3b82f6" : rpe <= 7.5 ? "#f59e0b" : "#ff2d2d";
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>RPE</span>
        <span className="text-sm font-black" style={{ color }}>{rpe.toFixed(1)} / 10</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}80` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
        />
      </div>
    </div>
  );
}

export function FeedbackCard({ feedback }: FeedbackCardProps) {
  const { score, pros, corrections, liftType, reps, rpe, advice } = feedback;
  const [copied, setCopied] = useState(false);

  const copyAdvice = async () => {
    try {
      await navigator.clipboard.writeText(advice);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full rounded-2xl border overflow-hidden"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        <Zap className="w-5 h-5 text-[#3b82f6]" />
        <div>
          <h3 className="font-black text-base uppercase tracking-wider" style={{ color: "var(--foreground)" }}>AI Form Analysis</h3>
          <p className="text-xs capitalize" style={{ color: "var(--muted)" }}>{liftType}</p>
        </div>
      </div>

      {/* Score + Stats row */}
      <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-0 border-b"
        style={{ borderColor: "var(--border)" }}>
        <div className="flex flex-col items-center justify-center py-7 px-6 gap-2 w-full sm:w-auto border-b sm:border-b-0 sm:border-r"
          style={{ borderColor: "var(--border)" }}>
          <ScoreRing score={score} />
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Form Score
          </p>
        </div>

        <div className="flex-1 flex flex-col justify-center gap-5 px-6 py-7">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "var(--surface-2)" }}>
              <RotateCcw className="w-5 h-5 text-[#3b82f6]" />
            </div>
            <div>
              <div className="text-2xl font-black" style={{ color: "var(--foreground)" }}>
                {reps}
                <span className="text-sm font-semibold ml-1" style={{ color: "var(--muted)" }}>reps</span>
              </div>
              <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--muted)" }}>
                Detected
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "var(--surface-2)" }}>
              <Gauge className="w-5 h-5 text-[#f59e0b]" />
            </div>
            <div className="flex-1">
              <RpeBar rpe={rpe} />
            </div>
          </div>
        </div>
      </div>

      {/* AI Advice block */}
      <div className="px-5 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-[#3b82f6]">
            <Zap className="w-4 h-4" />
            Coach Advice
          </h4>
          <button
            onClick={copyAdvice}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all"
            style={{
              color: copied ? "#3b82f6" : "var(--muted)",
              background: "var(--surface-2)",
            }}
            aria-label="Copy advice"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--foreground)" }}>
          {advice}
        </p>
      </div>

      {/* Pros / Corrections */}
      <div className="grid sm:grid-cols-2">
        <div className="p-5 space-y-3 border-b sm:border-b-0 sm:border-r" style={{ borderColor: "var(--border)" }}>
          <h4 className="text-xs font-black uppercase tracking-widest text-[#3b82f6] flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            What You Nailed
          </h4>
          <ul className="space-y-2">
            {pros.map((pro) => (
              <motion.li key={pro} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-start gap-2 text-sm" style={{ color: "var(--foreground)" }}>
                <span className="text-[#3b82f6] mt-0.5 shrink-0">&#10003;</span>
                {pro}
              </motion.li>
            ))}
          </ul>
        </div>
        <div className="p-5 space-y-3">
          <h4 className="text-xs font-black uppercase tracking-widest text-[#ff2d2d] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Fix These
          </h4>
          <ul className="space-y-2">
            {corrections.map((fix) => (
              <motion.li key={fix} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-start gap-2 text-sm" style={{ color: "var(--foreground)" }}>
                <span className="text-[#ff2d2d] mt-0.5 shrink-0">!</span>
                {fix}
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}