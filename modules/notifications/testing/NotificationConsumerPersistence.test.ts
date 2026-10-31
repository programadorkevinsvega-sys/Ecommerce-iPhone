import { afterEach, describe, expect, it } from "vitest";
import type { EmailProvider } from "../application/NotificationPorts";
import type {
  NotificationInboxItem,
  NotificationEvent,
  NotificationRecipient,
} from "../domain/NotificationEvent";
import type { NotificationPreferenceRepository } from "../application/NotificationPreferenceRepository";
import type { NotificationRealtimePort } from "../application/NotificationRealtimePort";
import { NotificationService } from "../application/NotificationService";
import { D1NotificationDeliveryRepository } from "../infrastructure/D1NotificationDeliveryRepository";
import { D1NotificationInboxRepository } from "../infrastructure/D1NotificationInboxRepository";
import { D1NotificationOutboxRepository } from "../infrastructure/D1NotificationOutboxRepository";
import { createNotificationTestDatabase } from "./createNotificationTestDatabase";

let database: ReturnType<typeof createNotificationTestDatabase>;

afterEach(() => database.close());

describe("NotificationService D1 consumer persistence", () => {
  it("persists one inbox item and one email delivery when duplicate queue deliveries race", async () => {
    database = createNotificationTestDatabase();
    database.exec(`
      CREATE TABLE notification_inbox (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_version INTEGER NOT NULL DEFAULT 1,
        recipient_type TEXT NOT NULL CHECK(recipient_type IN ('customer','technician','admin')),
        recipient_id TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        read_at TEXT,
        expires_at TEXT,
        dedupe_key TEXT NOT NULL UNIQUE,
        UNIQUE(event_id, recipient_type, recipient_id)
      );
      CREATE TABLE notification_channel_deliveries (
        id TEXT PRIMARY KEY,
        notification_id TEXT NOT NULL,
        channel TEXT NOT NULL CHECK(channel IN ('EMAIL','IN_APP')),
        recipient_type TEXT NOT NULL CHECK(recipient_type IN ('customer','technician','admin')),
        recipient_id TEXT NOT NULL,
        recipient TEXT,
        status TEXT NOT NULL CHECK(status IN ('PENDING','CLAIMED','SENT','FAILED','TERMINAL')),
        attempts INTEGER NOT NULL DEFAULT 0,
        provider TEXT NOT NULL,
        provider_message_id TEXT,
        last_error TEXT,
        next_retry_at TEXT,
        lease_token TEXT,
        lease_expires_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sent_at TEXT,
        FOREIGN KEY(notification_id) REFERENCES notification_inbox(id)
      );
      CREATE UNIQUE INDEX idx_notification_channel_unique
        ON notification_channel_deliveries(notification_id, channel, recipient_type, recipient_id);
    `);

    const recipient: NotificationRecipient = {
      type: "customer",
      id: "customer-1",
      email: "buyer@example.com",
    };
    const event: NotificationEvent = {
      id: "order-created:order-1",
      eventType: "OrderCreated",
      eventVersion: 1,
      aggregateId: "order-1",
      createdAt: new Date().toISOString(),
      recipients: [recipient],
      payload: {
        email: "buyer@example.com",
        orderId: "order-1",
        orderNumber: "EIP-2026-ORDER1",
        status: "PENDING_PAYMENT",
        totalInCents: 100000,
        currency: "COP",
      },
    };

    const outbox = new D1NotificationOutboxRepository(database.asD1());
    await outbox.enqueue(event);

    let sendCalls = 0;
    let emailStarted!: () => void;
    let releaseEmail!: () => void;
    const started = new Promise<void>((resolve) => {
      emailStarted = resolve;
    });
    const emailGate = new Promise<void>((resolve) => {
      releaseEmail = resolve;
    });
    const email: EmailProvider = {
      send: async () => {
        sendCalls += 1;
        emailStarted();
        await emailGate;
        return { id: "resend-message-1" };
      },
    };
    const realtime: NotificationRealtimePort = {
      publish: async (_item: NotificationInboxItem) => undefined,
    };
    const preferences: NotificationPreferenceRepository = {
      isEnabled: async (
        _recipient: NotificationRecipient,
        _channel: "EMAIL" | "IN_APP",
        _eventType: string,
      ) => true,
      list: async () => [],
      set: async () => undefined,
    };
    const service = new NotificationService(
      outbox,
      email,
      new D1NotificationInboxRepository(database.asD1()),
      realtime,
      new D1NotificationDeliveryRepository(database.asD1()),
      preferences,
    );

    const firstDelivery = service.processByOutboxId(event.id);
    await started;
    await service.processByOutboxId(event.id);

    expect(sendCalls).toBe(1);
    expect(
      database.query<{ count: number }>("SELECT COUNT(*) AS count FROM notification_inbox")[0]
        .count,
    ).toBe(1);
    expect(
      database.query<{ count: number }>(
        "SELECT COUNT(*) AS count FROM notification_channel_deliveries",
      )[0].count,
    ).toBe(1);

    releaseEmail();
    await firstDelivery;
    await service.processByOutboxId(event.id);

    const inboxCount = database.query<{ count: number }>(
      "SELECT COUNT(*) AS count FROM notification_inbox WHERE event_id=? AND recipient_type='customer' AND recipient_id='customer-1'",
      event.id,
    )[0].count;
    const delivery = database.query<{ status: string; provider_message_id: string | null }>(
      "SELECT status,provider_message_id FROM notification_channel_deliveries WHERE notification_id=(SELECT id FROM notification_inbox WHERE event_id=?) AND channel='EMAIL'",
      event.id,
    )[0];
    const outboxRecord = await outbox.findById(event.id);

    expect(sendCalls).toBe(1);
    expect(inboxCount).toBe(1);
    expect(delivery).toMatchObject({
      status: "SENT",
      provider_message_id: "resend-message-1",
    });
    expect(outboxRecord?.status).toBe("PROCESSED");
    expect(
      database.query<{ count: number }>("SELECT COUNT(*) AS count FROM notification_outbox")[0]
        .count,
    ).toBe(1);
  });
});
