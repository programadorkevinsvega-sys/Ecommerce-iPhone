const EDGE_BLOCK_BODY_MARKERS =
  /attention required|sorry,\s*you have been blocked|cloudflare ray id|cf-error-details|cf-chl-|just a moment|error\s*1020|web application firewall|access denied \| cloudflare/i;

function readHeader(headers, name) {
  if (typeof headers?.get === "function") {
    return headers.get(name);
  }

  const normalizedName = name.toLowerCase();
  const entry = Object.entries(headers ?? {}).find(
    ([headerName]) => headerName.toLowerCase() === normalizedName,
  );

  return entry ? String(entry[1]) : null;
}

/**
 * Identifies a Cloudflare-generated 403 without mistaking application 403s
 * for edge blocks. A Worker response carrying x-request-id is application
 * evidence and must remain a real application response.
 *
 * Accepts both Fetch Headers and Playwright's allHeaders() record.
 */
export function isCloudflareEdgeBlock(response, bodyText = "") {
  if (response?.status !== 403) return false;

  const headers = response.headers;
  if (readHeader(headers, "x-request-id")) return false;

  const server = (readHeader(headers, "server") ?? "").toLowerCase();
  const cfRay = readHeader(headers, "cf-ray");
  const mitigation = (readHeader(headers, "cf-mitigated") ?? "").toLowerCase();
  const hasCloudflareBodyMarker = EDGE_BLOCK_BODY_MARKERS.test(String(bodyText));

  return (
    mitigation === "challenge" ||
    ((server.includes("cloudflare") || Boolean(cfRay)) && hasCloudflareBodyMarker)
  );
}
