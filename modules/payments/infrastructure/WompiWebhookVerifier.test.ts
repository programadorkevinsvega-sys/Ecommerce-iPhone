import { describe, expect, it } from "vitest";
import { verifyWompiWebhook } from "./WompiWebhookVerifier";

describe("Wompi webhook verification", () => {
  it("rejects sandbox events on the production endpoint", async () => {
    const payload = JSON.stringify({ environment: "test", event: "transaction.updated", data: {}, signature: {}, timestamp: 1 });
    await expect(verifyWompiWebhook(payload, "real-secret", "checksum")).rejects.toThrow("Only Wompi production webhooks are accepted");
  });

  it("rejects invalid checksums", async () => {
    const payload = JSON.stringify({
      environment: "prod",
      event: "transaction.updated",
      data: { transaction: { id: "tx-1", status: "APPROVED" } },
      signature: { properties: ["transaction.id", "transaction.status"], checksum: "bad" },
      timestamp: 1,
    });
    await expect(verifyWompiWebhook(payload, "real-secret", "bad")).rejects.toThrow("Invalid Wompi webhook signature");
  });
});
