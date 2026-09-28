import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["exec", "prettier", "--write", "."],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  },
);

const stdout = result.stdout ?? "";
const stderr = result.stderr ?? "";
const outputLines = stdout.split(/\r?\n/).filter(Boolean);

let formatted = 0;
let unchanged = 0;

for (const line of outputLines) {
  const match = line.match(/^(.*?)(?:\s+)(\d+)ms(?:\s+\(unchanged\))?$/);
  if (!match) continue;

  if (line.endsWith("(unchanged)")) {
    unchanged += 1;
  } else {
    formatted += 1;
  }
}

const errorLines = [...stdout.split(/\r?\n/), ...stderr.split(/\r?\n/)]
  .map((line) => line.trimEnd())
  .filter((line) => line.includes("[error]"));

const otherStderr = stderr
  .split(/\r?\n/)
  .map((line) => line.trimEnd())
  .filter((line) => line && !line.includes("[error]"));

console.log("");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("PRETTIER");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`✓ Formateados:  ${formatted}`);
console.log(`✓ Sin cambios: ${unchanged}`);
console.log(`✗ Errores:     ${errorLines.length}`);

if (errorLines.length > 0) {
  console.log("");
  console.log("Errores:");
  for (const line of errorLines) {
    console.log(`  ${line}`);
  }
}

if (otherStderr.length > 0 && result.status !== 0) {
  console.log("");
  console.log("Salida adicional:");
  for (const line of otherStderr) {
    console.log(`  ${line}`);
  }
}

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("");

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
