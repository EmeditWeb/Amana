"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "amana-trade-draft";

export type TradeData = {
  // Step 1
  commodity: string;
  quantity: string;
  unit: string;
  pricePerUnit: string;
  currency: string;
  sellerAddress: string;
  // Step 2
  buyerRatio: number;
  sellerRatio: number;
  deliveryDays: string;
  notes: string;
};

const defaults: TradeData = {
  commodity: "",
  quantity: "",
  unit: "kg",
  pricePerUnit: "",
  currency: "NGN",
  sellerAddress: "",
  buyerRatio: 50,
  sellerRatio: 50,
  deliveryDays: "7",
  notes: "",
};

// --- Step context (only step navigation) ---
type TradeStepContextType = {
  step: number;
  setStep: (s: number) => void;
};

const TradeStepContext = createContext<TradeStepContextType>({
  step: 1,
  setStep: () => {},
});

// --- Data context (only form data) ---
type TradeDataContextType = {
  data: TradeData;
  update: (partial: Partial<TradeData>) => void;
  clearDraft: () => void;
};

const TradeDataContext = createContext<TradeDataContextType>({
  data: defaults,
  update: () => {},
  clearDraft: () => {},
});

function loadDraft(): TradeData {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TradeData>;
      return { ...defaults, ...parsed };
    }
  } catch {
    // corrupted storage — ignore
  }
  return defaults;
}

export function TradeProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<TradeData>(() => loadDraft());

  // Persist draft to localStorage on every change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [data]);

  const update = useCallback(
    (partial: Partial<TradeData>) =>
      setData((prev) => ({ ...prev, ...partial })),
    [],
  );

  const clearDraft = useCallback(() => {
    setData(defaults);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const stepValue = useMemo(() => ({ step, setStep }), [step]);
  const dataValue = useMemo(
    () => ({ data, update, clearDraft }),
    [data, update, clearDraft],
  );

  return (
    <TradeStepContext.Provider value={stepValue}>
      <TradeDataContext.Provider value={dataValue}>
        {children}
      </TradeDataContext.Provider>
    </TradeStepContext.Provider>
  );
}

/** Access step navigation — only re-renders when step changes */
export const useTradeStep = () => useContext(TradeStepContext);

/** Access form data + update — only re-renders when data changes */
export const useTradeData = () => useContext(TradeDataContext);

/** Legacy combined hook (backwards-compatible) */
export function useTrade() {
  const { step, setStep } = useTradeStep();
  const { data, update } = useTradeData();
  return { step, setStep, data, update };
}
