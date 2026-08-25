import { listTradesQuerySchema } from "../schemas/trade.schemas";

describe("listTradesQuerySchema", () => {
  it("accepts valid numeric query parameters", async () => {
    const result = await listTradesQuerySchema.parseAsync({
      page: "2",
      limit: "50",
    });
    expect(result).toMatchObject({ page: 2, limit: 50 });
  });

  it("applies defaults when parameters are omitted", async () => {
    const result = await listTradesQuerySchema.parseAsync({});
    expect(result).toMatchObject({ page: 1, limit: 20 });
  });

  it("rejects non-numeric page with a clear error", async () => {
    await expect(
      listTradesQuerySchema.parseAsync({ page: "abc" })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          path: ["page"],
          message: "page must be a valid number",
        }),
      ]),
    });
  });

  it("rejects non-numeric limit with a clear error", async () => {
    await expect(
      listTradesQuerySchema.parseAsync({ limit: "xyz" })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          path: ["limit"],
          message: "limit must be a valid number",
        }),
      ]),
    });
  });

  it("rejects NaN produced from numeric-looking strings like 'NaN'", async () => {
    await expect(
      listTradesQuerySchema.parseAsync({ page: "NaN" })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ path: ["page"] }),
      ]),
    });
  });

  it("rejects values that violate the underlying number constraints", async () => {
    await expect(
      listTradesQuerySchema.parseAsync({ page: "0", limit: "200" })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ path: ["page"] }),
        expect.objectContaining({ path: ["limit"] }),
      ]),
    });
  });
});
