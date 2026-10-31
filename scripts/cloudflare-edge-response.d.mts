type HeaderCollection =
  | { get(name: string): string | null }
  | Record<string, string | undefined>;

export function isCloudflareEdgeBlock(
  response: { status: number; headers: HeaderCollection },
  bodyText?: string,
): boolean;
