// OpenNext owns HTTP routing; this wrapper adds Cloudflare Queue and Scheduled handlers.
// @ts-ignore OpenNext generates this module during build.
import nextWorker from "./.open-next/worker.js";
import type { ExecutionContext, ScheduledEvent } from "@cloudflare/workers-types";
import { D1NotificationOutboxRepository } from "../../modules/notifications/infrastructure/D1NotificationOutboxRepository";
import { NotificationService } from "../../modules/notifications/application/NotificationService";
import { ResendEmailProvider } from "../../modules/notifications/infrastructure/ResendEmailProvider";
import type { NotificationEvent } from "../../modules/notifications/domain/NotificationEvent";

type Env = CloudflareEnv & {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
};
type QueueMessage = { body: NotificationEvent | string; ack(): void; retry(): void };
type QueueBatch = { messages: QueueMessage[] };

const service = (env: Env) => new NotificationService(
  new D1NotificationOutboxRepository(env.DB),
  new ResendEmailProvider(env.RESEND_API_KEY ?? "", env.EMAIL_FROM ?? ""),
);

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return nextWorker.fetch(request, env, ctx);
  },
  async scheduled(_event: ScheduledEvent, env: Env) {
    const repo = new D1NotificationOutboxRepository(env.DB);
    const pending = await repo.pending(50);
    for (const event of pending) {
      try {
        await env.EVENTS_QUEUE.send(JSON.stringify(event));
        await repo.markQueued(event.id);
      } catch (error) {
        await repo.markFailed(
          event.id,
          error instanceof Error ? error.message : String(error),
          new Date(Date.now() + 60_000).toISOString().replace("T", " ").replace("Z", ""),
        );
      }
    }
  },
  async queue(batch: QueueBatch, env: Env) {
    const notifications = service(env);
    for (const message of batch.messages) {
      try {
        const event = typeof message.body === "string"
          ? JSON.parse(message.body) as NotificationEvent
          : message.body;
        await notifications.process(event);
        message.ack();
      } catch {
        message.retry();
      }
    }
  },
};
