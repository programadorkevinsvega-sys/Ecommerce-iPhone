export type ScheduledTask = Readonly<{
  name: string;
  run: () => Promise<unknown>;
}>;

export type ScheduledTaskOutcome = Readonly<{
  task: string;
  outcome: "success" | "failed";
  durationMs: number;
  error?: Readonly<{ type: string; message: string }>;
}>;

export type ScheduledTaskLogger = Readonly<{
  log: (message: string) => void;
  error: (message: string) => void;
}>;

export function sanitizeScheduledErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(
      /\b(api[_-]?key|(?:access[_-]?|refresh[_-]?)?token|password|secret|authorization)\s*[:=]\s*["']?[^,\s"']+/gi,
      "$1=[REDACTED]",
    )
    .replace(/https?:\/\/[^/\s:@]+:[^@\s]+@/gi, "https://[REDACTED]@")
    .replace(/\s+/g, " ")
    .slice(0, 240);
}

export async function runScheduledTasks(
  tasks: readonly ScheduledTask[],
  logger: ScheduledTaskLogger = console,
): Promise<readonly ScheduledTaskOutcome[]> {
  const outcomes: ScheduledTaskOutcome[] = [];

  for (const task of tasks) {
    const startedAt = Date.now();
    try {
      await task.run();
      outcomes.push({
        task: task.name,
        outcome: "success",
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      outcomes.push({
        task: task.name,
        outcome: "failed",
        durationMs: Date.now() - startedAt,
        error: {
          type: error instanceof Error ? error.name : "UnknownError",
          message: sanitizeScheduledErrorMessage(error),
        },
      });
    }
  }

  const failedTasks = outcomes.filter((outcome) => outcome.outcome === "failed");
  const summary = JSON.stringify({
    event: "scheduled_tasks_summary",
    taskCount: outcomes.length,
    failedTaskCount: failedTasks.length,
    tasks: outcomes,
  });

  if (failedTasks.length > 0) {
    logger.error(summary);
    throw new Error(
      `SCHEDULED_TASKS_FAILED:${failedTasks.map((outcome) => outcome.task).join(",")}`,
    );
  }

  logger.log(summary);
  return outcomes;
}
