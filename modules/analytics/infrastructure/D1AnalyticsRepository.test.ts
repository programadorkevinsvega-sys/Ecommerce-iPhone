import { describe, expect, it } from "vitest";
import { D1AnalyticsRepository } from "./D1AnalyticsRepository";
import { D1SqliteTestDatabase } from "../../shared-kernel/testing/D1SqliteTestDatabase";
import type { AnalyticsEvent } from "../domain/AnalyticsEvent";

const event: AnalyticsEvent = {
  eventId: "evt_01JTESTANALYTICS01",
  eventType: "ProductViewed",
  eventVersion: 1,
  occurredAt: "2026-09-29T00:00:00.000Z",
  receivedAt: "2026-09-29T00:00:01.000Z",
  sessionId: "ses_01JTESTANALYTICS01",
  visitorId: "vis_01JTESTANALYTICS01",
  source: "web",
  payload: { productId: "prod_123", slug: "iphone-16" },
};

describe("D1AnalyticsRepository", () => {
  it("records cart abandonment only while the same non-empty cart is still inactive", async () => {
    const database = new D1SqliteTestDatabase();
    try {
      database.exec(
        "INSERT INTO products (id,name,slug,active,price_in_cents,currency,stock) VALUES (?,?,?,?,?,?,?)",
        "product-abandoned", "Probe Product", "probe-product", 1, 100, "COP", 5,
      );
      database.exec(
        "INSERT INTO carts (id,customer_id,currency,updated_at) VALUES (?,?,?,datetime('now','-31 minutes'))",
        "cart-abandoned", null, "COP",
      );
      database.exec(
        "INSERT INTO cart_items (cart_id,product_id,quantity,unit_price_in_cents) VALUES (?,?,?,?)",
        "cart-abandoned", "product-abandoned", 1, 100,
      );
      const lastActivityAt = database.query<{ updated_at: string }>(
        "SELECT updated_at FROM carts WHERE id=?", "cart-abandoned",
      )[0]!.updated_at;
      const repository = new D1AnalyticsRepository(database.asD1());
      const event: AnalyticsEvent = {
        eventId: "cart-abandoned:cart-abandoned:" + lastActivityAt.replace(" ", "T").replaceAll(":", "-"),
        eventType: "CartAbandoned",
        eventVersion: 1,
        occurredAt: new Date(lastActivityAt.replace(" ", "T") + "Z").toISOString(),
        receivedAt: new Date().toISOString(),
        sessionId: "cart-abandoned",
        visitorId: "cart-abandoned",
        source: "server",
        payload: { cartId: "cart-abandoned", itemCount: 1, abandonmentMinutes: 31 },
      };

      await expect(
        repository.recordAbandonedCartIfStillEligible(event, "cart-abandoned", lastActivityAt),
      ).resolves.toBe(true);
      await expect(
        repository.recordAbandonedCartIfStillEligible(event, "cart-abandoned", lastActivityAt),
      ).resolves.toBe(false);

      database.exec("UPDATE carts SET updated_at=CURRENT_TIMESTAMP WHERE id=?", "cart-abandoned");
      await expect(
        repository.recordAbandonedCartIfStillEligible(event, "cart-abandoned", lastActivityAt),
      ).resolves.toBe(false);

      const rows = database.query<{ count: number }>(
        "SELECT COUNT(*) AS count FROM analytics_events WHERE event_type='CartAbandoned'",
      );
      expect(rows[0]?.count).toBe(1);
    } finally {
      database.close();
    }
  });
  it("deduplicates repeated event identifiers", async () => {
    const database = new D1SqliteTestDatabase();
    try {
      const repository = new D1AnalyticsRepository(database.asD1());
      await repository.record(event);
      await repository.record(event);
      const rows = database.query<{ count: number }>("SELECT COUNT(*) AS count FROM analytics_events");
      expect(rows[0]?.count).toBe(1);
    } finally {
      database.close();
    }
  });
});
