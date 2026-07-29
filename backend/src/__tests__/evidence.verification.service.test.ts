jest.mock("axios", () => ({
  get: jest.fn(),
}));

import axios from "axios";
import { EvidenceVerificationService } from "../services/evidence.verification.service";
import { IPFSService } from "../services/ipfs.service";

const mockAxiosGet = axios.get as jest.Mock;

describe("EvidenceVerificationService", () => {
  let mockPrisma: {
    tradeEvidence: {
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let mockIpfs: jest.Mocked<Pick<IPFSService, "verifyPin" | "uploadFile" | "getFileUrl">>;
  let service: EvidenceVerificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = {
      tradeEvidence: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    mockIpfs = {
      verifyPin: jest.fn(),
      uploadFile: jest.fn(),
      getFileUrl: jest.fn(),
    };
    mockAxiosGet.mockReset();
    service = new EvidenceVerificationService(mockPrisma as any, mockIpfs as any, 10);
  });

  function makeEvidence(overrides: Record<string, unknown> = {}) {
    return {
      id: overrides.id ?? 1,
      tradeId: overrides.tradeId ?? "trade-001",
      cid: overrides.cid ?? "QmTest123",
      filename: overrides.filename ?? "evidence.jpg",
      mimeType: overrides.mimeType ?? "image/jpeg",
      uploadedBy: overrides.uploadedBy ?? "guser",
      createdAt: overrides.createdAt ?? new Date(),
    };
  }

  describe("verifyAll", () => {
    it("should return VerificationReport structure with no evidence", async () => {
      mockPrisma.tradeEvidence.findMany.mockResolvedValue([]);

      const report = await service.verifyAll();

      expect(report).toHaveProperty("totalChecked", 0);
      expect(report).toHaveProperty("pinnedCount", 0);
      expect(report).toHaveProperty("missingCount", 0);
      expect(report).toHaveProperty("errorCount", 0);
      expect(report).toHaveProperty("missingPins", []);
      expect(report).toHaveProperty("errors", []);
      expect(report).toHaveProperty("checkedAt");
      expect(report).toHaveProperty("durationMs");
    });

    it("should report evidence as pinned when verified", async () => {
      mockPrisma.tradeEvidence.findMany.mockResolvedValue([
        makeEvidence({ id: 1, cid: "QmPinned1" }),
      ]);
      mockIpfs.verifyPin.mockResolvedValue({
        pinned: true,
        cid: "QmPinned1",
        name: "test",
        size: 1000,
        timestamp: "2025-01-01T00:00:00Z",
      });

      const report = await service.verifyAll();

      expect(report.totalChecked).toBe(1);
      expect(report.pinnedCount).toBe(1);
      expect(report.missingCount).toBe(0);
      expect(report.errorCount).toBe(0);
    });

    it("should report evidence as missing when not pinned", async () => {
      mockPrisma.tradeEvidence.findMany.mockResolvedValue([
        makeEvidence({ id: 1, cid: "QmMissing1" }),
      ]);
      mockIpfs.verifyPin.mockResolvedValue({
        pinned: false,
        cid: "QmMissing1",
      });

      const report = await service.verifyAll();

      expect(report.totalChecked).toBe(1);
      expect(report.pinnedCount).toBe(0);
      expect(report.missingCount).toBe(1);
      expect(report.missingPins).toHaveLength(1);
      expect(report.missingPins[0]!.cid).toBe("QmMissing1");
    });

    it("should report errors when verification fails", async () => {
      mockPrisma.tradeEvidence.findMany.mockResolvedValue([
        makeEvidence({ id: 1, cid: "QmError1" }),
      ]);
      mockIpfs.verifyPin.mockResolvedValue({
        pinned: false,
        cid: "QmError1",
        error: "Network error",
      });

      const report = await service.verifyAll();

      expect(report.errorCount).toBe(1);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]!.pinResult.error).toBe("Network error");
    });

    it("should handle multiple evidence records with batch processing", async () => {
      const records = Array.from({ length: 25 }, (_, i) =>
        makeEvidence({ id: i, cid: `QmTest${i}` }),
      );
      mockPrisma.tradeEvidence.findMany.mockResolvedValue(records);
      mockIpfs.verifyPin.mockResolvedValue({
        pinned: true,
        cid: "placeholder",
      });

      const report = await service.verifyAll();

      expect(report.totalChecked).toBe(25);
      expect(mockIpfs.verifyPin).toHaveBeenCalled();
    });

    it("should handle duplicate CIDs efficiently", async () => {
      mockPrisma.tradeEvidence.findMany.mockResolvedValue([
        makeEvidence({ id: 1, cid: "QmDup" }),
        makeEvidence({ id: 2, cid: "QmDup" }),
        makeEvidence({ id: 3, cid: "QmDup" }),
      ]);
      mockIpfs.verifyPin.mockResolvedValue({
        pinned: true,
        cid: "QmDup",
      });

      const report = await service.verifyAll();

      expect(report.totalChecked).toBe(3);
      expect(report.pinnedCount).toBe(3);
      expect(mockIpfs.verifyPin).toHaveBeenCalledTimes(1);
    });
  });

  describe("repairMissingPins", () => {
    it("should repair missing evidence successfully", async () => {
      mockIpfs.getFileUrl.mockReturnValue("https://gateway.example.com/QmMissing1");
      mockAxiosGet.mockResolvedValue({ data: Buffer.from("test-data") });
      mockIpfs.uploadFile.mockResolvedValue("QmMissing1");

      const missingRecords = [
        {
          evidenceId: 1,
          tradeId: "trade-001",
          cid: "QmMissing1",
          filename: "evidence.jpg",
          mimeType: "image/jpeg",
          uploadedBy: "guser",
          createdAt: new Date(),
          pinResult: { pinned: false, cid: "QmMissing1" },
        },
      ];

      const results = await service.repairMissingPins(missingRecords);

      expect(results).toHaveLength(1);
      expect(results[0]!.success).toBe(true);
      expect(results[0]!.cid).toBe("QmMissing1");
      expect(mockPrisma.tradeEvidence.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { cid: "QmMissing1" },
      });
    });

    it("should handle CID mismatch after re-pin", async () => {
      mockIpfs.getFileUrl.mockReturnValue("https://gateway.example.com/QmOld");
      mockAxiosGet.mockResolvedValue({ data: Buffer.from("test-data") });
      mockIpfs.uploadFile.mockResolvedValue("QmNewCID");

      const missingRecords = [
        {
          evidenceId: 1,
          tradeId: "trade-001",
          cid: "QmOld",
          filename: "evidence.jpg",
          mimeType: "image/jpeg",
          uploadedBy: "guser",
          createdAt: new Date(),
          pinResult: { pinned: false, cid: "QmOld" },
        },
      ];

      const results = await service.repairMissingPins(missingRecords);

      expect(results).toHaveLength(1);
      expect(results[0]!.success).toBe(true);
      expect(mockPrisma.tradeEvidence.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { cid: "QmNewCID" },
      });
    });

    it("should handle gateway fetch failure", async () => {
      mockIpfs.getFileUrl.mockReturnValue("https://gateway.example.com/QmMissing");
      mockAxiosGet.mockRejectedValue(new Error("Gateway unreachable"));

      const missingRecords = [
        {
          evidenceId: 1,
          tradeId: "trade-001",
          cid: "QmMissing",
          filename: "evidence.jpg",
          mimeType: "image/jpeg",
          uploadedBy: "guser",
          createdAt: new Date(),
          pinResult: { pinned: false, cid: "QmMissing" },
        },
      ];

      const results = await service.repairMissingPins(missingRecords);

      expect(results).toHaveLength(1);
      expect(results[0]!.success).toBe(false);
      expect(results[0]!.error).toBeDefined();
    });

    it("should report errors during repair", async () => {
      mockIpfs.getFileUrl.mockImplementation(() => {
        throw new Error("IPFS service unavailable");
      });

      const missingRecords = [
        {
          evidenceId: 1,
          tradeId: "trade-001",
          cid: "QmFail",
          filename: "bad.jpg",
          mimeType: "image/jpeg",
          uploadedBy: "guser",
          createdAt: new Date(),
          pinResult: { pinned: false, cid: "QmFail" },
        },
      ];

      const results = await service.repairMissingPins(missingRecords);

      expect(results).toHaveLength(1);
      expect(results[0]!.success).toBe(false);
    });
  });
});
