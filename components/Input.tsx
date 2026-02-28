import { cn } from "@/lib/utils";
import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-sm font-semibold text-[#aaa] uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        className={cn(
          "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-[#f0f0f0]",
          "placeholder-[#555] focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]",
          "transition-all duration-200 text-base min-h-[44px]",
          error && "border-[#ff2d2d] focus:border-[#ff2d2d] focus:ring-[#ff2d2d]",
          className
        )}
        {...props}
      />
      {error && <p className="text-[#ff2d2d] text-xs">{error}</p>}
    </div>
  );
}
