"use client";
import { SignUp } from "@clerk/nextjs";
import { useTheme } from "@/components/ThemeProvider";

export default function SignUpPage() {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 pt-28"
      style={{ background: "var(--background)" }}>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/login"
        fallbackRedirectUrl="/dashboard"
        appearance={{
          layout: { socialButtonsVariant: "blockButton" },
          variables: {
            colorPrimary: "#3b82f6",
            colorBackground: dark ? "#111111" : "#ffffff",
            colorInputBackground: dark ? "#0a0a0a" : "#f5f5f5",
            colorInputText: dark ? "#f0f0f0" : "#0a0a0a",
            colorText: dark ? "#f0f0f0" : "#0a0a0a",
            colorTextSecondary: dark ? "#777777" : "#666666",
            colorDanger: "#ff2d2d",
            borderRadius: "0.75rem",
            fontFamily: "inherit",
          },
          elements: {
            card: dark
              ? "bg-[#111] border border-[#2a2a2a] shadow-none"
              : "bg-white border border-[#d0d0d0] shadow-none",
            formButtonPrimary: "bg-[#3b82f6] text-white font-black hover:bg-[#2563eb]",
            footerActionLink: "text-[#3b82f6] hover:text-[#2563eb]",
            socialButtonsBlockButton: dark
              ? "border border-[#2a2a2a] bg-[#1a1a1a] text-[#f0f0f0] hover:bg-[#222]"
              : "border border-[#d0d0d0] bg-[#f0f0f0] text-[#0a0a0a] hover:bg-[#e0e0e0]",
            socialButtonsBlockButtonText: dark ? "text-[#f0f0f0] font-semibold" : "text-[#0a0a0a] font-semibold",
            dividerLine: dark ? "bg-[#2a2a2a]" : "bg-[#d0d0d0]",
            dividerText: dark ? "text-[#555]" : "text-[#888]",
          },
        }}
      />
    </main>
  );
}