"use client";

import { type TrustScoreBreakdown } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import {
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
} from "lucide-react";

interface TrustScoreBreakdownCardProps {
  breakdown: TrustScoreBreakdown;
}

export function TrustScoreBreakdownCard({
  breakdown,
}: TrustScoreBreakdownCardProps) {
  const { t } = useTranslation();

  const items = [
    {
      label: t("trust.breakdown.base"),
      value: breakdown.baseScore,
      icon: <Activity className="w-4 h-4" />,
      color: "text-text-secondary",
    },
    {
      label: t("trust.breakdown.tradeCompletion"),
      value: breakdown.tradeCompletionBonus,
      icon: <CheckCircle2 className="w-4 h-4" />,
      color: "text-status-success",
      prefix: "+",
    },
    {
      label: t("trust.breakdown.volumeBonus"),
      value: breakdown.volumeBonus,
      icon: <TrendingUp className="w-4 h-4" />,
      color: "text-gold",
      prefix: "+",
    },
    {
      label: t("trust.breakdown.disputePenalty"),
      value: breakdown.disputePenalty,
      icon: <AlertTriangle className="w-4 h-4" />,
      color: "text-status-danger",
      prefix: "-",
    },
    {
      label: t("trust.breakdown.activityDecay"),
      value: breakdown.activityDecay,
      icon: <Clock className="w-4 h-4" />,
      color: breakdown.activityDecay >= 0 ? "text-status-success" : "text-status-danger",
      prefix: breakdown.activityDecay >= 0 ? "+" : "",
    },
  ];

  return (
    <div className="bg-bg-elevated rounded-lg border border-border-default p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4">
        {t("trust.breakdown.title")}
      </h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between py-2 border-b border-border-default last:border-b-0"
          >
            <div className="flex items-center gap-2">
              <span className={item.color}>{item.icon}</span>
              <span className="text-sm text-text-secondary">{item.label}</span>
            </div>
            <span className={`text-sm font-medium ${item.color}`}>
              {item.prefix}
              {typeof item.value === "number"
                ? item.value % 1 === 0
                  ? item.value
                  : item.value.toFixed(1)
                : item.value}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-3 border-t border-border-default">
          <span className="text-sm font-semibold text-text-primary">
            {t("trust.breakdown.finalScore")}
          </span>
          <span className="text-lg font-bold text-gold">
            {breakdown.finalScore}
          </span>
        </div>
      </div>
    </div>
  );
}

export default TrustScoreBreakdownCard;
