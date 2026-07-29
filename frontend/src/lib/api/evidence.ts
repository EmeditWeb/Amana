import { request } from "./client";

export interface UploadVideoEvidenceResponse {
  evidenceId: string;
  cid: string;
  ipfsUrl: string;
}

export const evidenceApi = {
  uploadVideo: (tradeId: string, file: File, token: string) => {
    const data = new FormData();
    data.append("tradeId", tradeId);
    data.append("file", file);

    return request<UploadVideoEvidenceResponse>("/evidence/video", {
      method: "POST",
      body: data,
      token,
    });
  },
};
