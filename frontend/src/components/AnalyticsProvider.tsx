"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import {
  isAnalyticsOptedOut,
  setAnalyticsOptOut,
  trackApiFailure,
  trackAuthEvent,
  trackDisputeEvent,
  trackEvent,
  trackFailure,
  trackFunnelStep,
  trackPageView,
  trackTradeCreationStep,
  trackTradeStatusChange,
} from "@/lib/analytics";

interface AnalyticsContextValue {
  trackEvent: (eventName: string, payload?: Record<string, unknown>) => void;
  trackFunnelStep: (step: string, metadata?: Record<string, unknown>) => void;
  trackFailure: (errorType: string, metadata?: Record<string, unknown>) => void;
  trackApiFailure: (endpoint: string, status: number, metadata?: Record<string, unknown>) => void;
  trackAuthEvent: (step: string, status: "started" | "success" | "failed", metadata?: Record<string, unknown>) => void;
  trackPageView: (page: string) => void;
  trackTradeCreationStep: (step: string, metadata?: Record<string, unknown>) => void;
  trackTradeStatusChange: (toStatus: string, metadata?: Record<string, unknown>) => void;
  trackDisputeEvent: (action: string, metadata?: Record<string, unknown>) => void;
  isOptedOut: () => boolean;
  setOptOut: (optOut: boolean) => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const trackEventCallback = useCallback(
    (eventName: string, payload: Record<string, unknown> = {}) => {
      trackEvent(eventName, payload);
    },
    [],
  );

  const trackFunnel = useCallback(
    (step: string, metadata: Record<string, unknown> = {}) => {
      trackFunnelStep(step, metadata);
    },
    [],
  );

  const trackFailureCallback = useCallback(
    (errorType: string, metadata: Record<string, unknown> = {}) => {
      trackFailure(errorType, metadata);
    },
    [],
  );

  const trackApiFailureCallback = useCallback(
    (endpoint: string, status: number, metadata: Record<string, unknown> = {}) => {
      trackApiFailure(endpoint, status, metadata);
    },
    [],
  );

  const trackAuthEventCallback = useCallback(
    (step: string, status: "started" | "success" | "failed", metadata: Record<string, unknown> = {}) => {
      trackAuthEvent(step, status, metadata);
    },
    [],
  );

  const trackPageViewCallback = useCallback((page: string) => {
    trackPageView(page);
  }, []);

  const trackTradeCreationStepCallback = useCallback(
    (step: string, metadata: Record<string, unknown> = {}) => {
      trackTradeCreationStep(step, metadata);
    },
    [],
  );

  const trackTradeStatusChangeCallback = useCallback(
    (toStatus: string, metadata: Record<string, unknown> = {}) => {
      trackTradeStatusChange(toStatus, metadata);
    },
    [],
  );

  const trackDisputeEventCallback = useCallback(
    (action: string, metadata: Record<string, unknown> = {}) => {
      trackDisputeEvent(action, metadata);
    },
    [],
  );

  const isOptedOut = useCallback(() => isAnalyticsOptedOut(), []);

  const setOptOut = useCallback((optOut: boolean) => {
    setAnalyticsOptOut(optOut);
  }, []);

  const value = useMemo(
    () => ({
      trackEvent: trackEventCallback,
      trackFunnelStep: trackFunnel,
      trackFailure: trackFailureCallback,
      trackApiFailure: trackApiFailureCallback,
      trackAuthEvent: trackAuthEventCallback,
      trackPageView: trackPageViewCallback,
      trackTradeCreationStep: trackTradeCreationStepCallback,
      trackTradeStatusChange: trackTradeStatusChangeCallback,
      trackDisputeEvent: trackDisputeEventCallback,
      isOptedOut,
      setOptOut,
    }),
    [
      trackEventCallback,
      trackFailureCallback,
      trackFunnel,
      trackApiFailureCallback,
      trackAuthEventCallback,
      trackPageViewCallback,
      trackTradeCreationStepCallback,
      trackTradeStatusChangeCallback,
      trackDisputeEventCallback,
      isOptedOut,
      setOptOut,
    ],
  );

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error("useAnalytics must be used within an AnalyticsProvider");
  }
  return context;
}
