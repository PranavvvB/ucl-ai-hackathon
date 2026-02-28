"use client";
import { useState, useRef, useCallback } from "react";
import { Upload, Video, X, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

interface VideoUploaderProps {
  onUpload: (file: File) => void;
  uploading?: boolean;
  uploadedUrl?: string | null;
}

export function VideoUploader({ onUpload, uploading, uploadedUrl }: VideoUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (file.type !== "video/mp4") {
        setError("Only .mp4 files are supported.");
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError(`Your video is ${formatBytes(file.size)} - the limit is ${MAX_SIZE_MB}MB. Try compressing it or trimming it shorter.`);
        return;
      }
      const url = URL.createObjectURL(file);
      setPreview(url);
      setFileName(file.name);
      setFileSize(formatBytes(file.size));
      onUpload(file);
    },
    [onUpload]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clearFile = () => {
    setPreview(null);
    setFileName(null);
    setFileSize(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!preview ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className={cn(
              "relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200",
              "flex flex-col items-center justify-center gap-4 min-h-[220px]",
              dragging ? "border-[#3b82f6] shadow-[0_0_30px_#3b82f620]" : error ? "border-[#ff2d2d]" : "hover:border-[#3b82f6]"
            )}
            style={{
              background: dragging ? "rgba(57,255,20,0.03)" : error ? "rgba(255,45,45,0.03)" : "var(--surface)",
              borderColor: dragging ? "#3b82f6" : error ? "#ff2d2d" : "var(--border)",
            }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept="video/mp4" className="hidden" onChange={onInputChange} />
            <div className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200"
              style={{ background: dragging ? "rgba(57,255,20,0.12)" : error ? "rgba(255,45,45,0.12)" : "var(--surface-2)" }}>
              {error
                ? <AlertCircle className="w-7 h-7 text-[#ff2d2d]" />
                : <Upload className={cn("w-7 h-7 transition-colors", dragging ? "text-[#3b82f6]" : "")}
                    style={{ color: dragging ? "#3b82f6" : "var(--muted)" }} />
              }
            </div>
            <div>
              <p className="font-bold text-lg" style={{ color: "var(--foreground)" }}>
                {dragging ? "Drop it!" : error ? "Try a different file" : "Upload Your Lift Video"}
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                Tap to select or drag and drop  MP4 only  Max {MAX_SIZE_MB}MB
              </p>
            </div>
            {error && <p className="text-[#ff2d2d] text-sm font-medium px-2">{error}</p>}
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl overflow-hidden border"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <video src={preview} controls playsInline className="w-full max-h-[400px] object-contain bg-black" />
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Video className="w-4 h-4 text-[#3b82f6] shrink-0" />
                <span className="text-sm truncate" style={{ color: "var(--muted)" }}>{fileName}</span>
                {fileSize && <span className="text-xs shrink-0" style={{ color: "var(--muted)" }}>{fileSize}</span>}
                {uploadedUrl && <CheckCircle className="w-4 h-4 text-[#3b82f6] shrink-0" />}
              </div>
              {!uploading && (
                <button
                  onClick={clearFile}
                  className="p-1.5 rounded-lg hover:text-[#ff2d2d] transition-all min-h-0 w-8 h-8"
                  style={{ color: "var(--muted)" }}
                  aria-label="Remove video"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {uploading && (
                <span className="flex items-center gap-2 text-xs text-[#3b82f6] font-semibold">
                  <span className="w-3 h-3 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
                  Uploading...
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
