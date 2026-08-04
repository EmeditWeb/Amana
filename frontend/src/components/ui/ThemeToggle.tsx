"use client";

import { useTheme } from "@/hooks/useTheme";

const ICONS: Record<string, string> = {
  light: "☀️",
  dark: "🌙",
  system: "💻",
};

const LABELS: Record<string, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    const order: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
    const currentIdx = order.indexOf(theme);
    const next = order[(currentIdx + 1) % order.length];
    setTheme(next);
  };

  return (
    <button
      onClick={cycle}
      className="flex items-center gap-1.5 rounded-lg border border-default bg-card px-3 py-2 text-sm text-text-secondary hover:border-hover hover:text-text-primary transition-colors"
      title={`Theme: ${LABELS[theme]} — click to switch`}
      aria-label={`Current theme: ${LABELS[theme]}. Click to change.`}
    >
      <span className="text-base leading-none" aria-hidden="true">
        {ICONS[theme]}
      </span>
      <span className="hidden sm:inline">{LABELS[theme]}</span>
    </button>
  );
}
