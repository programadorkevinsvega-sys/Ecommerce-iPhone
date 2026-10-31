import type { MessageBatch } from "@cloudflare/workers-types";
import worker, { NotificationHub } from "./worker";
import { runScheduledWorker } from "./lib/scheduledWorker";

type E2EEnv = CloudflareEnv & {
  E2E_DISABLE_NOTIFICATION_DELIVERY?: string;
};

export { NotificationHub };

export default {
  ...worker,
  async queue(batch: MessageBatch<string>, env: E2EEnv) {
    if (
      batch.queue === "ecommerce-iphone-notifications" &&
      env.E2E_DISABLE_NOTIFICATION_DELIVERY === "true"
    ) {
      for (const message of batch.messages) message.ack();
      return;
    }

    await worker.queue(batch, env);
  },
  scheduled: runScheduledWorker,
};
