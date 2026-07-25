"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError, type TrustScoreDetails } from "@/lib/api";
import { RepScoreRing } from "@/components/ui/RepScoreRing";
import { TrustScoreBadge } from "@/components/ui/TrustScoreBadge";
import { TrustScoreBreakdownCard } from "@/components/ui/TrustScoreBreakdownCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/hooks/useTranslation";
import {
  AlertCircle, RefreshCw, TrendingUp, CheckCircle2,
  AlertTriangle, Clock, Activity, DollarSign, CalendarDays,
} from "lucide-react";

function SkeletonReputationPage() {
  return (
    <div className="px-6 py-8 max-w-6xl mx-auto space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-bg-elevated rounded-lg border border-border-default p-8 flex flex-col items-center gap-4">
          <Skeleton className="h-32 w-32 rounded-full" />
          <Skeleton className="h-5 w-16" />
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-elevated rounded-lg border border-border-default p-6 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-bg-elevated rounded-lg border border-border-default">
        <div className="p-6 border-b border-border-default space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function getImpactColor(impact: number): string {
  if (impact > 0) return "text-status-success";
  if (impact < 0) return "text-status-danger";
  return "text-text-secondary";
}

function getImpactLabel(impact: number): string {
  if (impact > 0) return `+${impact}`;
  return `${impact}`;
}

function getEventIcon(type: string) {
  switch (type) {
    case "trade_completed":
      return <CheckCircle2 className="w-4 h-4 text-status-success" />;
    case "trade_initiated":
      return <Clock className="w-4 h-4 text-status-info" />;
    case "dispute_initiated":
      return <AlertTriangle className="w-4 h-4 text-status-warning" />;
    case "dispute_lost":
      return <AlertCircle className="w-4 h-4 text-status-danger" />;
    case "volume_milestone":
      return <DollarSign className="w-4 h-4 text-gold" />;
    default:
      return <TrendingUp className="w-4 h-4 text-text-secondary" />;
  }
}

export default function ReputationPage() {
  const { t } = useTranslation();
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [data, setData] = useState<TrustScoreDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  const fetchTrustScore = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const details = await api.reputation.getMyTrustScore(token);
      setData(details);
      setUsingFallback(false);
    } catch {
      try {
        const reputation = await api.reputation.getMyReputation(token);
        setData({
          trustScore: reputation.trustScore,
          breakdown: {
            baseScore: 50,
            tradeCompletionBonus: 0,
            volumeBonus: 0,
            disputePenalty: 0,
            activityDecay: 0,
            finalScore: reputation.trustScore,
          },
          stats: {
            totalTrades: reputation.totalTrades,
            completedTrades: reputation.completedTrades,
            disputedTrades: reputation.disputedTrades,
            totalVolumeUsdc: 0,
            successRate: reputation.successRate,
            accountAgeDays: 0,
            lastTradeAt: null,
          },
          tier: reputation.trustScore >= 85 ? "elite" : reputation.trustScore >= 70 ? "trusted" : reputation.trustScore >= 55 ? "established" : reputation.trustScore >= 35 ? "developing" : "newcomer",
          history: reputation.history.map((h) => ({
            ...h,
            decayedImpact: h.impact,
            type: h.type === "dispute_resolved" ? "dispute_lost" : h.type as TrustScoreDetails["history"][0]["type"],
          })),
        });
        setUsingFallback(true);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(t("reputation.failedToLoad"));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    if (isAuthenticated && token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchTrustScore();
    }
  }, [isAuthenticated, token, fetchTrustScore]);

  const isPageLoading = authLoading || (isAuthenticated && loading);

  if (!isAuthenticated && !authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-bg-elevated border border-border-default flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-gold" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary">{t("reputation.connectWallet")}</h1>
        <p className="text-text-secondary max-w-md">
          {t("reputation.connectWalletDescription")}
        </p>
      </div>
    );
  }

  if (isPageLoading) {
    return <SkeletonReputationPage />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-bg-elevated border border-border-default flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-status-danger" />
        </div>
        <h1 className="text-xl font-semibold text-text-primary">{t("reputation.failedToLoad")}</h1>
        <p className="text-text-secondary max-w-md">{error}</p>
        <Button variant="primary" onClick={fetchTrustScore}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {t("reputation.tryAgain")}
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-bg-elevated border border-border-default flex items-center justify-center">
          <TrendingUp className="w-8 h-8 text-text-secondary" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary">{t("reputation.noData")}</h1>
        <p className="text-text-secondary max-w-md">
          {t("reputation.noDataDescription")}
        </p>
      </div>
    );
  }

  const ringScore = (data.trustScore / 100) * 5;

  const stats = [
    {
      label: t("reputation.totalTrades"),
      value: data.stats.totalTrades.toString(),
      icon: <TrendingUp className="w-5 h-5 text-gold" />,
    },
    {
      label: t("reputation.completed"),
      value: data.stats.completedTrades.toString(),
      icon: <CheckCircle2 className="w-5 h-5 text-status-success" />,
    },
    {
      label: t("reputation.disputed"),
      value: data.stats.disputedTrades.toString(),
      icon: <AlertTriangle className="w-5 h-5 text-status-warning" />,
    },
    {
      label: t("reputation.successRate"),
      value: `${data.stats.successRate}%`,
      icon: <Activity className="w-5 h-5 text-status-info" />,
    },
  ];

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">{t("reputation.title")}</h1>
        <p className="text-text-secondary">
          {t("reputation.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-bg-elevated rounded-lg border border-border-default p-8 flex flex-col items-center gap-4">
          <RepScoreRing score={ringScore} size="xl" animated />
          <p className="text-sm text-text-secondary mt-2">{t("reputation.trustScore")}</p>
          <p className="text-3xl font-bold text-text-primary">{data.trustScore}</p>
          <TrustScoreBadge score={data.trustScore} tier={data.tier} size="md" />
          <p className="text-xs text-text-muted">{t("trust.outOf")}</p>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-bg-elevated rounded-lg border border-border-default p-6"
            >
              <div className="flex items-center gap-2 mb-3">
                {stat.icon}
                <h3 className="text-sm font-medium text-text-secondary">{stat.label}</h3>
              </div>
              <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
            </div>
          ))}
          <div className="bg-bg-elevated rounded-lg border border-border-default p-6">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-5 h-5 text-gold" />
              <h3 className="text-sm font-medium text-text-secondary">{t("trust.stats.totalVolume")}</h3>
            </div>
            <p className="text-2xl font-bold text-text-primary">
              {data.stats.totalVolumeUsdc.toLocaleString()} USDC
            </p>
          </div>
          <div className="bg-bg-elevated rounded-lg border border-border-default p-6">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-5 h-5 text-text-secondary" />
              <h3 className="text-sm font-medium text-text-secondary">{t("trust.stats.accountAge")}</h3>
            </div>
            <p className="text-2xl font-bold text-text-primary">
              {data.stats.accountAgeDays > 0 ? `${data.stats.accountAgeDays}d` : t("trust.never")}
            </p>
          </div>
        </div>
      </div>

      {!usingFallback && (
        <div className="mb-8">
          <TrustScoreBreakdownCard breakdown={data.breakdown} />
        </div>
      )}

      {usingFallback && (
        <div className="mb-8">
          <div className="bg-status-warning/10 border border-status-warning/30 rounded-lg p-4 text-sm text-status-warning">
            Enhanced trust score breakdown not available. Showing basic reputation data.
          </div>
        </div>
      )}

      <div className="bg-bg-elevated rounded-lg border border-border-default">
        <div className="p-6 border-b border-border-default">
          <h2 className="text-xl font-semibold text-text-primary">{t("reputation.trustHistory")}</h2>
          <p className="text-sm text-text-secondary mt-1">
            {t("reputation.trustHistorySubtitle")}
          </p>
        </div>
        <div className="p-6">
          {data.history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <Clock className="w-12 h-12 text-text-muted" />
              <p className="text-text-secondary">
                {t("reputation.trustHistoryEmpty")}
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {data.history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-3 border-b border-border-default last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {getEventIcon(item.type)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-text-primary">{item.event}</div>
                      <div className="text-xs text-text-secondary flex items-center gap-2">
                        <span>{formatDate(item.timestamp)}</span>
                        {"decayedImpact" in item && item.decayedImpact !== item.impact && (
                          <span className="text-text-muted">
                            ({t("trust.history.decayedImpact")}: {item.decayedImpact})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`text-sm font-medium ${getImpactColor(item.impact)}`}>
                    {getImpactLabel(item.impact)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}