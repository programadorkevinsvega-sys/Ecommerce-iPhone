import { readFile } from "node:fs/promises";

const REQUIRED_NODE = "24.18.0";
const frozen = process.env.npm_config_frozen_lockfile;

if (process.version.slice(1) !== REQUIRED_NODE) {
  console.error(`Unsupported Node.js version: ${process.version}. Required: ${REQUIRED_NODE}.`);
  process.exit(1);
}

if (frozen === "false" || frozen === "0") {
  console.error("pnpm --no-frozen-lockfile is forbidden for this repository.");
  process.exit(1);
}

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
if (packageJson.engines?.node !== REQUIRED_NODE) {
  console.error("package.json must pin the exact supported Node.js version.");
  process.exit(1);
}

console.log(`Install toolchain verified: Node ${REQUIRED_NODE}, frozen-lockfile=${frozen ?? "enforced by .npmrc"}.`);
