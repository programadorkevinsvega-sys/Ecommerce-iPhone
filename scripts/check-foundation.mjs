import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  "package.json",
  "pnpm-lock.yaml",
  "wrangler.jsonc",
  ".env.example",
  ".gitignore",
  "docs/architecture.md",
  "docs/development.md",
  "scripts/check-architecture.mjs",
  ".github/workflows/ci.yml",
  "apps/web/next.config.ts",
  "apps/web/worker.ts",
];

const failures = [];

for (const file of requiredFiles) {
  try {
    await access(file);
  } catch {
    failures.push(`missing required foundation file: ${file}`);
  }
}

const wrangler = await readFile("wrangler.jsonc", "utf8");
for (const environment of ["development", "staging"]) {
  if (!wrangler.includes(`\"${environment}\"`)) {
    failures.push(`wrangler environment is not declared: ${environment}`);
  }
}

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
for (const script of ["architecture:check", "foundation:check", "typecheck", "test", "build", "build:cloudflare", "format:check"]) {
  if (!packageJson.scripts?.[script]) failures.push(`missing root quality script: ${script}`);
}

const gitignore = await readFile(".gitignore", "utf8");
for (const entry of [".env", ".env.*", ".dev.vars", ".dev.vars.*"]) {
  if (!gitignore.includes(entry)) failures.push(`secret file is not ignored: ${entry}`);
}

if (failures.length) {
  console.error("Foundation invariant check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Foundation invariant check passed.");
