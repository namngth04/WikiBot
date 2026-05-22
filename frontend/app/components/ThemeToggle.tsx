"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Lấy theme ban đầu từ localStorage hoặc system preference
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    const initialTheme = savedTheme || (systemPrefersDark ? "dark" : "light");
    setTheme(initialTheme);
    
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);

    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Tránh hiện tượng Hydration Mismatch của Next.js SSR
  if (!mounted) {
    return (
      <div className="w-8 h-8 rounded-md bg-surface-2 border border-hairline flex items-center justify-center text-ink-muted opacity-50">
        <Sun size={16} />
      </div>
    );
  }

  return (
    <motion.button
      id="theme-toggle-button"
      onClick={toggleTheme}
      className="w-8 h-8 rounded-md bg-surface-1 border border-hairline hover:bg-surface-2 hover:border-hairline-strong flex items-center justify-center text-ink-muted hover:text-ink transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-brand-lavender/50 cursor-pointer"
      whileTap={{ scale: 0.95 }}
      title={theme === "light" ? "Chuyển sang Giao diện Tối (Linear)" : "Chuyển sang Giao diện Sáng (Stripe)"}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={theme}
          initial={{ y: -10, opacity: 0, rotate: -45 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: 10, opacity: 0, rotate: 45 }}
          transition={{ duration: 0.15 }}
          className="flex items-center justify-center"
        >
          {theme === "light" ? (
            <Sun size={16} className="text-amber-500" />
          ) : (
            <Moon size={16} className="text-brand-lavender" />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.button>
  );
}
