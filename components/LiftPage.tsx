"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { VideoUploader } from "@/components/VideoUploader";
import { FeedbackCard, LiftFeedback } from "@/components/FeedbackCard";
import { Button } from "@/components/Button";
import { Zap, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";

// Backend endpoint that accepts POST with { videoUrl } and returns:
//   { reps, rpe, advice, score, pros, corrections, liftType }
const ANALYZE_ENDPOINT = "/api/analyze-lift";

interface LiftPageProps {
  liftType: string;
  title: string;
  description: string;
}

export function LiftPage({ liftType, title, description }: LiftPageProps) {
  const { user } = useUser();
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<LiftFeedback | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    setFeedback(null);
    setUploadedUrl(null);
    setUploadError(null);
    setAnalyzeError(null);
    setSaveError(null);
    setUploading(true);

    try {
      if (!user) throw new Error("You must be logged in to upload videos.");

      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);
      formData.append("folder", `powerai/${user.id}`);
      formData.append("resource_type", "video");

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
        { method: "POST", body: formData }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? "Upload failed.");
      }

      const data = await res.json();
      setUploadedUrl(data.secure_url);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }, [user]);

  const handleAnalyze = useCallback(async () => {
    if (!uploadedUrl || !user) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAnalyzing(true);
    setFeedback(null);
    setAnalyzeError(null);
    setSaveError(null);

    let analyzed: LiftFeedback | null = null;

    try {
      const res = await fetch(ANALYZE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: uploadedUrl }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`Analysis failed (${res.status}).`);

      const raw = await res.json();

      analyzed = {
        reps:        raw.reps,
        rpe:         raw.rpe,
        advice:      raw.advice,
        score:       raw.score,
        pros:        raw.pros,
        corrections: raw.corrections,
        liftType:    raw.liftType || liftType,
      };

      setFeedback(analyzed);
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "AbortError") return;
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed. Try again.");
      return;
    } finally {
      setAnalyzing(false);
    }

    if (!analyzed) return;
    setSaving(true);
    try {
      const saveRes = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          liftType: analyzed.liftType,
          videoUrl: uploadedUrl,
          score: analyzed.score,
          pros: analyzed.pros,
          corrections: analyzed.corrections,
        }),
        signal: controller.signal,
      });
      if (!saveRes.ok) throw new Error("Could not save session.");
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "AbortError") return;
      setSaveError("Session could not be saved to history.");
    } finally {
      setSaving(false);
    }
  }, [uploadedUrl, user, liftType]);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <Navbar />
      <main className="pt-20 px-4 pb-20 max-w-2xl mx-auto">
        <div className="py-8">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight uppercase mb-2">
            {title}
          </h1>
          <p className="text-base" style={{ color: "var(--muted)" }}>{description}</p>
        </div>

        <div className="space-y-3">
          <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Step 1 — Upload Your Video
          </h2>
          <VideoUploader
            onUpload={handleUpload}
            uploading={uploading}
            uploadedUrl={uploadedUrl}
          />

          <AnimatePresence>
            {uploadError && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-sm text-[#ff2d2d] bg-[#ff2d2d10] border border-[#ff2d2d30] rounded-lg px-4 py-3"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {uploadError}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {uploadedUrl && !uploading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Button
                  onClick={handleAnalyze}
                  loading={analyzing || saving}
                  className="w-full"
                  size="lg"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  {saving ? "Saving..." : analyzing ? "Analyzing..." : "Analyze My Form"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {analyzeError && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-sm text-[#ff2d2d] bg-[#ff2d2d10] border border-[#ff2d2d30] rounded-lg px-4 py-3"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {analyzeError}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {saveError && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-sm bg-[#f59e0b10] border border-[#f59e0b30] rounded-lg px-4 py-3"
                style={{ color: "#f59e0b" }}
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {saveError}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 space-y-3"
            >
              <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Step 2 — Your AI Feedback
              </h2>
              <FeedbackCard feedback={feedback} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
