import { request } from "./client";
import type { ReputationResponse, TrustScoreDetails } from "./types";

export const reputationApi = {
  getMyReputation: (token: string) =>
    request<ReputationResponse>("/users/me/reputation", { token }),

  getUserReputation: (address: string) =>
    request<ReputationResponse>(`/users/${address}/reputation`),

  getMyTrustScore: (token: string) =>
    request<TrustScoreDetails>("/users/me/trust-score", { token }),

  getUserTrustScore: (address: string) =>
    request<TrustScoreDetails>(`/users/${address}/trust-score`),
};
