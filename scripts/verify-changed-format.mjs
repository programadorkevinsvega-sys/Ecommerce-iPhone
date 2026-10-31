import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const zeroSha = "0000000000000000000000000000000000000000";
const baseSha = process.env.BASE_SHA?.trim();
let diffArguments;

if (baseSha && /^[a-f0-9]{40}$/i.test(baseSha) && baseSha !== zeroSha) {
  diffArguments = ["diff", "--name-only", "--diff-filter=ACMR", `${baseSha}...HEAD`];
} else {
  const previousCommit = spawnSync("git", ["rev-parse", "HEAD^"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  diffArguments =
    previousCommit.status === 0
      ? ["diff", "--name-only", "--diff-filter=ACMR", "HEAD^...HEAD"]
      : ["show", "--format=", "--name-only", "HEAD"];
}

const changedFilesResult = spawnSync("git", diffArguments, {
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
});

if (changedFilesResult.error || changedFilesResult.status !== 0) {
  console.error("Unable to determine changed files for the Prettier check.");
  if (changedFilesResult.error) console.error(changedFilesResult.error.message);
  process.exit(changedFilesResult.status ?? 1);
}

const changedFiles = (changedFilesResult.stdout ?? "")
  .split(/\r?\n/)
  .filter((file) => file && existsSync(file));

if (changedFiles.length === 0) {
  console.log("Prettier changed-file check passed: no changed files to check.");
  process.exit(0);
}

console.log(`Checking Prettier formatting for ${changedFiles.length} changed file(s).`);
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const prettierResult = spawnSync(
  pnpm,
  ["exec", "prettier", "--check", "--ignore-unknown", ...changedFiles],
  {
    cwd: process.cwd(),
    stdio: "inherit",
  },
);

if (prettierResult.error) {
  console.error(prettierResult.error.message);
  process.exit(1);
}

if (prettierResult.status !== 0) {
  console.error("Prettier-generated diff for changed files:");
  const writeResult = spawnSync(
    pnpm,
    ["exec", "prettier", "--write", "--ignore-unknown", ...changedFiles],
    { cwd: process.cwd(), stdio: "inherit" },
  );
  if (writeResult.status !== 0) {
    console.error("Unable to generate the Prettier diagnostic diff.");
    process.exit(1);
  }

  const diffResult = spawnSync("git", ["diff", "--", ...changedFiles], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (diffResult.status !== 0) {
    console.error("Unable to read the Prettier diagnostic diff.");
    process.exit(1);
  }
  console.error(diffResult.stdout);
}

process.exit(prettierResult.status ?? 1);
