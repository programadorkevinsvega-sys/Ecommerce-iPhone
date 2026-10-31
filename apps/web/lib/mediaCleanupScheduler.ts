export const MEDIA_CLEANUP_PREFIXES = [
  "product-images/",
  "category-images/",
  "service-images/",
  "home-carousel/",
] as const;

export const MEDIA_CLEANUP_SCAN_PAGE_SIZE = 250;

export type MediaCleanupScanState = Readonly<{
  cursor: string | null;
}>;

export interface MediaCleanupScanStore {
  loadDue(prefix: string): Promise<MediaCleanupScanState | null>;
  save(
    prefix: string,
    expectedCursor: string | null,
    cursor: string | null,
    completed: boolean,
  ): Promise<void>;
}

export interface MediaCleanupObject {
  key: string;
  uploaded: Date;
}

export interface MediaCleanupBucket {
  list(options: { prefix: string; limit: number; cursor?: string }): Promise<{
    objects: readonly MediaCleanupObject[];
    truncated: boolean;
    cursor?: string;
  }>;
}

export interface ProcessOrphanMediaPageInput {
  bucket: MediaCleanupBucket;
  scanStore: MediaCleanupScanStore;
  prefixes: readonly string[];
  cutoffTimestamp: number;
  cleanup: (key: string) => Promise<unknown>;
  pageSize?: number;
}

export interface ProcessOrphanMediaPageResult {
  pagesProcessed: number;
  objectsVisited: number;
  cleanupCandidates: number;
}

export async function processOrphanMediaPage(
  input: ProcessOrphanMediaPageInput,
): Promise<ProcessOrphanMediaPageResult> {
  const pageSize = input.pageSize ?? MEDIA_CLEANUP_SCAN_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
    throw new Error("INVALID_MEDIA_CLEANUP_PAGE_SIZE");
  }
  if (!Number.isFinite(input.cutoffTimestamp)) {
    throw new Error("INVALID_MEDIA_CLEANUP_CUTOFF");
  }

  let pagesProcessed = 0;
  let objectsVisited = 0;
  let cleanupCandidates = 0;

  for (const prefix of input.prefixes) {
    const state = await input.scanStore.loadDue(prefix);
    if (!state) continue;

    const page = await input.bucket.list({
      prefix,
      limit: pageSize,
      ...(state.cursor ? { cursor: state.cursor } : {}),
    });

    if (page.truncated && (!page.cursor || page.cursor === state.cursor)) {
      throw new Error("R2_CLEANUP_CURSOR_DID_NOT_ADVANCE");
    }

    for (const object of page.objects) {
      objectsVisited += 1;
      if (!(object.uploaded instanceof Date) || !Number.isFinite(object.uploaded.getTime())) {
        throw new Error("INVALID_R2_OBJECT_UPLOAD_TIMESTAMP");
      }
      if (object.uploaded.getTime() <= input.cutoffTimestamp) {
        await input.cleanup(object.key);
        cleanupCandidates += 1;
      }
    }

    await input.scanStore.save(
      prefix,
      state.cursor,
      page.truncated ? (page.cursor ?? null) : null,
      !page.truncated,
    );
    pagesProcessed += 1;
  }

  return { pagesProcessed, objectsVisited, cleanupCandidates };
}
