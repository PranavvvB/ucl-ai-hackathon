import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-bold rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

  const variants = {
    primary:
      "bg-[#3b82f6] text-black hover:shadow-[0_0_20px_#3b82f680] hover:bg-[#2563eb]",
    secondary:
      "bg-[var(--surface-2)] text-[#3b82f6] border border-[#3b82f6] hover:bg-[#3b82f6] hover:text-black",
    ghost:
      "bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-2)] border border-[var(--border)]",
    danger:
      "bg-[#ff2d2d] text-white hover:shadow-[0_0_20px_#ff2d2d80] hover:bg-[#e02020]",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm min-h-[36px]",
    md: "px-5 py-2.5 text-base min-h-[44px]",
    lg: "px-6 py-3 text-base min-h-[48px]",
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Processing...
        </span>
      ) : (
        children
      )}
    </button>
  );
}
