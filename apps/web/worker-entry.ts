import worker, { NotificationHub } from "./worker";
import { runScheduledWorker } from "./lib/scheduledWorker";

export { NotificationHub };

export default {
  ...worker,
  scheduled: runScheduledWorker,
};
