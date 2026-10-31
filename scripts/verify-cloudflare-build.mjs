import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const appDirectory = join(process.cwd(), "apps", "web");
const nextDirectory = join(appDirectory, ".next");
const openNextDirectory = join(appDirectory, ".open-next");
const failures = [];

async function countFiles(directory, predicate = () => true) {
  const entries = await readdir(directory, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      count += await countFiles(entryPath, predicate);
    } else if (entry.isFile() && predicate(entryPath)) {
      count += 1;
    }
  }

  return count;
}

async function requireNonEmptyFile(path, description) {
  try {
    const file = await stat(path);
    if (!file.isFile() || file.size === 0) {
      failures.push(`${description} is empty or is not a file: ${path}`);
      return 0;
    }
    return file.size;
  } catch {
    failures.push(`${description} was not generated: ${path}`);
    return 0;
  }
}

const buildIdPath = join(nextDirectory, "BUILD_ID");
await requireNonEmptyFile(buildIdPath, "Next.js build ID");

let staticRouteCount = 0;
const prerenderManifestPath = join(nextDirectory, "prerender-manifest.json");
try {
  const manifest = JSON.parse(await readFile(prerenderManifestPath, "utf8"));
  staticRouteCount = Object.keys(manifest.routes ?? {}).length;
  if (staticRouteCount === 0) {
    failures.push("Next.js prerender manifest does not contain any generated static routes");
  }
} catch {
  failures.push(`Next.js prerender manifest is missing or invalid: ${prerenderManifestPath}`);
}

let staticHtmlCount = 0;
const staticPagesDirectory = join(nextDirectory, "server", "app");
try {
  staticHtmlCount = await countFiles(staticPagesDirectory, (path) => path.endsWith(".html"));
  if (staticHtmlCount === 0) {
    failures.push("Next.js did not generate any static HTML pages");
  }
} catch {
  failures.push(`Next.js static page output is missing: ${staticPagesDirectory}`);
}

const workerBundlePath = join(openNextDirectory, "worker.js");
const workerBundleBytes = await requireNonEmptyFile(workerBundlePath, "OpenNext Worker bundle");

let assetCount = 0;
const assetsDirectory = join(openNextDirectory, "assets");
try {
  assetCount = await countFiles(assetsDirectory);
  if (assetCount === 0) {
    failures.push("OpenNext generated an empty static assets directory");
  }
} catch {
  failures.push(`OpenNext static assets directory is missing: ${assetsDirectory}`);
}

if (failures.length > 0) {
  console.error("Cloudflare build artifact verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Cloudflare build artifact verification passed.");
console.log(`Static routes in Next.js prerender manifest: ${staticRouteCount}`);
console.log(`Static HTML files generated: ${staticHtmlCount}`);
console.log(`OpenNext Worker bundle size: ${workerBundleBytes} bytes`);
console.log(`OpenNext static assets generated: ${assetCount}`);
