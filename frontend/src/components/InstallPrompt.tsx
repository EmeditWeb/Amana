"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="border-b border-border-default bg-bg-elevated px-4 py-2 text-sm text-text-secondary">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <span>Install Amana for faster access and offline trade review.</span>
        <button
          type="button"
          onClick={install}
          className="rounded-md bg-gold px-3 py-1.5 font-semibold text-text-inverse transition-colors hover:bg-gold-hover"
        >
          Install
        </button>
      </div>
    </div>
  );
}
