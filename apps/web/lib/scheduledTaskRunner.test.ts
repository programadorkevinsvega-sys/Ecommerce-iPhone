import { describe, expect, it, vi } from "vitest";
import { runScheduledTasks } from "./scheduledTaskRunner";

describe("runScheduledTasks", () => {
  it("runs later tasks after one task fails and reports the aggregate failure", async () => {
    const executionOrder: string[] = [];
    const logger = { log: vi.fn(), error: vi.fn() };

    await expect(
      runScheduledTasks(
        [
          {
            name: "media-cleanup",
            run: async () => {
              executionOrder.push("media-cleanup");
              throw new Error("R2 operation failed with token=private-value");
            },
          },
          {
            name: "analytics-retention",
            run: async () => {
              executionOrder.push("analytics-retention");
            },
          },
        ],
        logger,
      ),
    ).rejects.toThrow("SCHEDULED_TASKS_FAILED:media-cleanup");

    expect(executionOrder).toEqual(["media-cleanup", "analytics-retention"]);
    expect(logger.log).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);

    const loggedSummary = logger.error.mock.calls[0]?.[0];
    expect(loggedSummary).toBeTypeOf("string");
    if (typeof loggedSummary !== "string") {
      throw new Error("Expected scheduled task failure summary to be logged");
    }

    const summary = JSON.parse(loggedSummary) as {
      failedTaskCount: number;
      tasks: Array<{ task: string; outcome: string; error?: { message: string } }>;
    };
    expect(summary.failedTaskCount).toBe(1);
    expect(summary.tasks[0]?.error?.message).not.toContain("private-value");
    expect(summary.tasks[1]?.outcome).toBe("success");
  });

  it("emits a success summary when every independent task completes", async () => {
    const logger = { log: vi.fn(), error: vi.fn() };
    const result = await runScheduledTasks(
      [{ name: "cms-publish", run: async () => undefined }],
      logger,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.outcome).toBe("success");
    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
