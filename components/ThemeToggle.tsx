"use client";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { motion } from "framer-motion";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label="Toggle light/dark mode"
      className="relative flex items-center justify-center w-9 h-9 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-[#aaa] hover:text-[#f0f0f0] hover:border-[#3b82f6] transition-all duration-200 cursor-pointer"
      style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--muted)" }}
    >
      <motion.div
        key={theme}
        initial={{ rotate: -30, opacity: 0, scale: 0.7 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        exit={{ rotate: 30, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {theme === "dark" ? (
          <Sun className="w-4 h-4 text-[#3b82f6]" />
        ) : (
          <Moon className="w-4 h-4 text-[#555]" />
        )}
      </motion.div>
    </button>
  );
}