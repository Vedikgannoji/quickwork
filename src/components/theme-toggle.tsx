import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "quickwork-theme";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(initial);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, mounted]);

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      className={
        "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-foreground transition-all duration-200 hover:scale-[1.03] hover:border-primary hover:text-primary " +
        (className ?? "")
      }
    >
      {mounted && theme === "dark" ? (
        <Sun className="size-[18px]" />
      ) : (
        <Moon className="size-[18px]" />
      )}
    </button>
  );
}
