import { TradeStatus } from "@prisma/client";

export { TradeStatus };

export enum EventType {
  TradeCreated = "TradeCreated",
  TradeFunded = "TradeFunded",
  TradeCancelled = "TradeCancelled",
  TradeCancelledByBuyer = "TradeCancelledByBuyer",
  TradeExpired = "TradeExpired",
  DeliveryConfirmed = "DeliveryConfirmed",
  FundsReleased = "FundsReleased",
  DisputeInitiated = "DisputeInitiated",
  DisputeResolved = "DisputeResolved",
  EvidenceSubmitted = "EvidenceSubmitted",
  VideoProofSubmitted = "VideoProofSubmitted",
  ManifestSubmitted = "ManifestSubmitted",
  DeadlineExtended = "DeadlineExtended",
  MediatorAdded = "MediatorAdded",
  MediatorRemoved = "MediatorRemoved",
  FeeRateUpdated = "FeeRateUpdated",
  FeesWithdrawn = "FeesWithdrawn",
  PathPaymentInitiated = "PathPaymentInitiated",
  PathPaymentExecuted = "PathPaymentExecuted",
  ContractUpgraded = "ContractUpgraded",
  Initialized = "Initialized",
}

export const EVENT_TO_STATUS: Record<EventType, TradeStatus | null> = {
  [EventType.TradeCreated]: TradeStatus.CREATED,
  [EventType.TradeFunded]: TradeStatus.FUNDED,
  [EventType.TradeCancelled]: TradeStatus.CANCELLED,
  [EventType.TradeCancelledByBuyer]: TradeStatus.CANCELLED,
  [EventType.TradeExpired]: TradeStatus.CANCELLED,
  [EventType.DeliveryConfirmed]: TradeStatus.DELIVERED,
  [EventType.FundsReleased]: TradeStatus.COMPLETED,
  [EventType.DisputeInitiated]: TradeStatus.DISPUTED,
  [EventType.DisputeResolved]: TradeStatus.COMPLETED,
  [EventType.EvidenceSubmitted]: null,
  [EventType.VideoProofSubmitted]: null,
  [EventType.ManifestSubmitted]: null,
  [EventType.DeadlineExtended]: null,
  [EventType.MediatorAdded]: null,
  [EventType.MediatorRemoved]: null,
  [EventType.FeeRateUpdated]: null,
  [EventType.FeesWithdrawn]: null,
  [EventType.PathPaymentInitiated]: null,
  [EventType.PathPaymentExecuted]: null,
  [EventType.ContractUpgraded]: null,
  [EventType.Initialized]: null,
};

export interface ParsedEvent {
  eventType: EventType;
  tradeId: string;
  ledgerSequence: number;
  contractId: string;
  eventId: string;
  data: Record<string, unknown>;
}

export interface SorobanContractEvent {
  type: string;
  ledger: number;
  contractId: string;
  id: string;
  topic: { type: string; value: string }[];
  value: { type: string; value: unknown };
}

export const EVENT_TOPIC_MAP: Record<string, EventType> = {
  "amana:initialized": EventType.Initialized,
  TRDCRT: EventType.TradeCreated,
  TRDFND: EventType.TradeFunded,
  TRDCAN: EventType.TradeCancelled,
  TCNBYR: EventType.TradeCancelledByBuyer,
  TRDEXP: EventType.TradeExpired,
  DELCNF: EventType.DeliveryConfirmed,
  RELSD: EventType.FundsReleased,
  DISINI: EventType.DisputeInitiated,
  DISRES: EventType.DisputeResolved,
  EVDSUB: EventType.EvidenceSubmitted,
  VIDPRF: EventType.VideoProofSubmitted,
  MNFST: EventType.ManifestSubmitted,
  DEDEXT: EventType.DeadlineExtended,
  MEDADD: EventType.MediatorAdded,
  MEDREM: EventType.MediatorRemoved,
  FEEUPD: EventType.FeeRateUpdated,
  FEEWTH: EventType.FeesWithdrawn,
  PTHINT: EventType.PathPaymentInitiated,
  PTHPAY: EventType.PathPaymentExecuted,
  UPGRAD: EventType.ContractUpgraded,
};
