"use client";

import { type TrustTier } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";

interface TrustScoreBadgeProps {
  score: number;
  tier: TrustTier;
  size?: "sm" | "md" | "lg";
}

const TIER_CONFIG: Record<
  TrustTier,
  { color: string; bgColor: string; borderColor: string; labelKey: string }
> = {
  newcomer: {
    color: "text-text-secondary",
    bgColor: "bg-bg-elevated",
    borderColor: "border-border-default",
    labelKey: "trust.tier.newcomer",
  },
  developing: {
    color: "text-status-info",
    bgColor: "bg-status-info/10",
    borderColor: "border-status-info/30",
    labelKey: "trust.tier.developing",
  },
  established: {
    color: "text-status-success",
    bgColor: "bg-status-success/10",
    borderColor: "border-status-success/30",
    labelKey: "trust.tier.established",
  },
  trusted: {
    color: "text-gold",
    bgColor: "bg-gold/10",
    borderColor: "border-gold/30",
    labelKey: "trust.tier.trusted",
  },
  elite: {
    color: "text-status-success",
    bgColor: "bg-status-success/20",
    borderColor: "border-status-success/40",
    labelKey: "trust.tier.elite",
  },
};

const SIZE_CONFIG = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
  lg: "px-4 py-1.5 text-base",
};

export function TrustScoreBadge({ score, tier, size = "md" }: TrustScoreBadgeProps) {
  const { t } = useTranslation();
  const config = TIER_CONFIG[tier];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${config.bgColor} ${config.color} ${config.borderColor} ${SIZE_CONFIG[size]}`}
    >
      <span className="font-bold">{score}</span>
      <span className="opacity-70">|</span>
      <span>{t(config.labelKey)}</span>
    </span>
  );
}

export default TrustScoreBadge;
