"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu, X, Dumbbell, LayoutDashboard, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useClerk, useAuth } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/ThemeToggle";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lifts", label: "Analyze Lift", icon: Dumbbell },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();
  const { userId } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b transition-colors duration-200"
        style={{ background: "color-mix(in srgb, var(--background) 90%, transparent)", borderColor: "var(--border)" }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 min-h-0">
            <Dumbbell className="w-7 h-7 text-[#3b82f6]" />
            <span className="font-black text-lg tracking-tight" style={{ color: "var(--foreground)" }}>
              POWER<span className="text-[#3b82f6]">AI</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {userId && navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 min-h-0",
                  pathname === link.href
                    ? "bg-[#3b82f6] text-black"
                    : "hover:bg-[#1a1a1a]"
                )}
                style={pathname !== link.href ? { color: "var(--muted)" } : {}}
              >
                {link.label}
              </Link>
            ))}
            {userId && (
              <button
                onClick={handleLogout}
                className="ml-2 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold hover:text-[#ff2d2d] hover:bg-[#1a1a1a] transition-all duration-200 min-h-0 cursor-pointer"
                style={{ color: "var(--muted)" }}
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            )}
            {!userId && (
              <Link
                href="/login"
                className="ml-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#3b82f6] text-black hover:bg-[#2563eb] transition-all duration-200"
              >
                Sign In
              </Link>
            )}
            <div className="ml-2">
              <ThemeToggle />
            </div>
          </div>

          {/* Mobile: theme toggle + hamburger */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              className="p-2 rounded-lg hover:bg-[#1a1a1a] min-h-0 w-10 h-10 flex items-center justify-center"
              style={{ color: "var(--foreground)" }}
              onClick={() => setOpen(!open)}
              aria-label="Toggle menu"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 backdrop-blur-lg pt-20 px-6 md:hidden"
            style={{ background: "color-mix(in srgb, var(--background) 95%, transparent)" }}
          >
            <div className="flex flex-col gap-3">
              {userId && navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-4 px-5 py-4 rounded-xl text-lg font-bold transition-all duration-200",
                      pathname === link.href
                        ? "bg-[#3b82f6] text-black"
                        : "border"
                    )}
                    style={pathname !== link.href ? { background: "var(--surface-2)", color: "var(--foreground)", borderColor: "var(--border)" } : {}}
                  >
                    <Icon className="w-5 h-5" />
                    {link.label}
                  </Link>
                );
              })}
              {userId && (
                <button
                  onClick={() => { setOpen(false); handleLogout(); }}
                  className="flex items-center gap-4 px-5 py-4 rounded-xl text-lg font-bold border text-[#ff2d2d] transition-all duration-200"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
              )}
              {!userId && (
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-4 px-5 py-4 rounded-xl text-lg font-bold bg-[#3b82f6] text-black transition-all duration-200"
                >
                  Sign In
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
