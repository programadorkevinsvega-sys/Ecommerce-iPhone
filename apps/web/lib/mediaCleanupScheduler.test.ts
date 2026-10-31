import { describe, expect, it, vi } from "vitest";
import {
  MEDIA_CLEANUP_SCAN_PAGE_SIZE,
  processOrphanMediaPage,
  type MediaCleanupObject,
} from "./mediaCleanupScheduler";

describe("processOrphanMediaPage", () => {
  it("resumes a bounded R2 scan from the persisted cursor and pauses after a complete pass", async () => {
    const cutoffTimestamp = Date.parse("2026-10-01T00:00:00.000Z");
    const oldObject: MediaCleanupObject = {
      key: "product-images/old-image.webp",
      uploaded: new Date("2026-09-01T00:00:00.000Z"),
    };
    const youngObject: MediaCleanupObject = {
      key: "product-images/new-image.webp",
      uploaded: new Date("2026-10-20T00:00:00.000Z"),
    };

    let cursor: string | null = null;
    let completed = false;
    const scanStore = {
      loadDue: vi.fn(async () => (completed ? null : { cursor })),
      save: vi.fn(
        async (
          _prefix: string,
          _expectedCursor: string | null,
          nextCursor: string | null,
          isComplete: boolean,
        ) => {
          cursor = nextCursor;
          completed = isComplete;
        },
      ),
    };
    const bucket = {
      list: vi
        .fn()
        .mockResolvedValueOnce({
          objects: [oldObject, youngObject],
          truncated: true,
          cursor: "opaque-page-2",
        })
        .mockResolvedValueOnce({
          objects: [
            {
              key: "product-images/second-page.webp",
              uploaded: new Date("2026-09-15T00:00:00.000Z"),
            },
          ],
          truncated: false,
          cursor: "opaque-final-cursor",
        }),
    };
    const cleanup = vi.fn(async () => undefined);

    const first = await processOrphanMediaPage({
      bucket,
      scanStore,
      prefixes: ["product-images/"],
      cutoffTimestamp,
      cleanup,
    });

    expect(first.pagesProcessed).toBe(1);
    expect(first.cleanupCandidates).toBe(1);
    expect(cursor).toBe("opaque-page-2");
    expect(completed).toBe(false);
    expect(bucket.list).toHaveBeenNthCalledWith(1, {
      prefix: "product-images/",
      limit: MEDIA_CLEANUP_SCAN_PAGE_SIZE,
    });

    const second = await processOrphanMediaPage({
      bucket,
      scanStore,
      prefixes: ["product-images/"],
      cutoffTimestamp,
      cleanup,
    });

    expect(second.pagesProcessed).toBe(1);
    expect(second.cleanupCandidates).toBe(1);
    expect(bucket.list).toHaveBeenNthCalledWith(2, {
      prefix: "product-images/",
      limit: MEDIA_CLEANUP_SCAN_PAGE_SIZE,
      cursor: "opaque-page-2",
    });
    expect(cursor).toBeNull();
    expect(completed).toBe(true);

    const nextScheduledRun = await processOrphanMediaPage({
      bucket,
      scanStore,
      prefixes: ["product-images/"],
      cutoffTimestamp,
      cleanup,
    });
    expect(nextScheduledRun.pagesProcessed).toBe(0);
    expect(bucket.list).toHaveBeenCalledTimes(2);
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it("does not advance a page cursor when processing an object fails", async () => {
    const save = vi.fn(async () => undefined);
    const bucket = {
      list: vi.fn(async () => ({
        objects: [
          {
            key: "product-images/failing.webp",
            uploaded: new Date("2026-09-01T00:00:00.000Z"),
          },
        ],
        truncated: true,
        cursor: "next-page",
      })),
    };

    await expect(
      processOrphanMediaPage({
        bucket,
        scanStore: {
          loadDue: async () => ({ cursor: null }),
          save,
        },
        prefixes: ["product-images/"],
        cutoffTimestamp: Date.parse("2026-10-01T00:00:00.000Z"),
        cleanup: async () => {
          throw new Error("temporary database failure");
        },
      }),
    ).rejects.toThrow("temporary database failure");

    expect(save).not.toHaveBeenCalled();
  });

  it("rejects a truncated response that cannot be resumed", async () => {
    await expect(
      processOrphanMediaPage({
        bucket: {
          list: async () => ({
            objects: [],
            truncated: true,
          }),
        },
        scanStore: {
          loadDue: async () => ({ cursor: null }),
          save: async () => undefined,
        },
        prefixes: ["product-images/"],
        cutoffTimestamp: Date.now(),
        cleanup: async () => undefined,
      }),
    ).rejects.toThrow("R2_CLEANUP_CURSOR_DID_NOT_ADVANCE");
  });

  it("uses the observed cursor as a compare-and-swap guard for page persistence", async () => {
    let persistedCursor: string | null = "page-1";
    const save = vi.fn(
      async (
        _prefix: string,
        expectedCursor: string | null,
        nextCursor: string | null,
        _completed: boolean,
      ) => {
        if (persistedCursor !== expectedCursor) {
          throw new Error("MEDIA_CLEANUP_SCAN_STATE_CHANGED");
        }
        persistedCursor = nextCursor;
      },
    );

    await expect(
      processOrphanMediaPage({
        bucket: {
          list: async () => {
            persistedCursor = "page-2";
            return {
              objects: [],
              truncated: true,
              cursor: "page-3",
            };
          },
        },
        scanStore: {
          loadDue: async () => ({ cursor: "page-1" }),
          save,
        },
        prefixes: ["product-images/"],
        cutoffTimestamp: Date.now(),
        cleanup: async () => undefined,
      }),
    ).rejects.toThrow("MEDIA_CLEANUP_SCAN_STATE_CHANGED");

    expect(save).toHaveBeenCalledWith("product-images/", "page-1", "page-3", false);
    expect(persistedCursor).toBe("page-1");
  });
});
