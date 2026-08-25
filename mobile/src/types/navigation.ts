export type RootStackParamList = {
  WalletConnect: undefined;
  TradeList: undefined;
  TradeDetail: { tradeId: string; id?: string };
  DisputeDetail: { id: string };
  CreateTrade: undefined;
  SyncQueue: undefined;
  EvidenceCapture: { tradeId: string };
  VaultDashboard: undefined;
  SecuritySettings: undefined;
};
