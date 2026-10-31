import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const workingDirectory = process.cwd();
const workspaceConfig = resolve(workingDirectory, "pnpm-workspace.yaml");
const repositoryRoot = existsSync(workspaceConfig)
  ? workingDirectory
  : resolve(workingDirectory, "../..");

type D1QueryResult<T> = {
  results?: T[];
  success?: boolean;
};

export function executeLocalD1(sql: string): string {
  const args = [
    "exec",
    "wrangler",
    "d1",
    "execute",
    "ecommerce-iphone",
    "--local",
    "--json",
    "--command",
    sql,
  ];

  return execFileSync("pnpm", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 4 * 1024 * 1024,
  });
}

export function queryLocalD1<T>(sql: string): T[] {
  const output = executeLocalD1(sql);
  const jsonStart = output.indexOf("[");
  if (jsonStart < 0) {
    throw new Error("Wrangler did not return JSON for the local E2E D1 query.");
  }

  const batches = JSON.parse(output.slice(jsonStart)) as D1QueryResult<T>[];
  if (!Array.isArray(batches)) {
    throw new Error("Wrangler returned an unexpected local D1 result.");
  }

  return batches.flatMap((batch) => batch.results ?? []);
}

export function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function resetCheckoutInventory(stock: number): void {
  if (!Number.isSafeInteger(stock) || stock < 0) {
    throw new Error("Checkout E2E stock must be a non-negative integer.");
  }

  const statements = [
    `UPDATE products SET stock=${stock} WHERE id='prod-iphone-17-pro-max' AND active=1`,
    "UPDATE products SET stock=0 WHERE id='prod-iphone-18-pro-max' AND active=1",
    "UPDATE product_variants SET price_in_cents=464900000 " +
      "WHERE id='var-iphone-17-256-deep-blue'",
  ];
  executeLocalD1(`${statements.join(";\n")};`);

  const availableProduct = queryLocalD1<{ active: number; stock: number }>(
    "SELECT active,stock FROM products WHERE id='prod-iphone-17-pro-max' LIMIT 1",
  );
  const unavailableProduct = queryLocalD1<{ active: number; stock: number }>(
    "SELECT active,stock FROM products WHERE id='prod-iphone-18-pro-max' LIMIT 1",
  );

  if (
    availableProduct.length !== 1 ||
    availableProduct[0].active !== 1 ||
    availableProduct[0].stock !== stock ||
    unavailableProduct.length !== 1 ||
    unavailableProduct[0].active !== 1 ||
    unavailableProduct[0].stock !== 0
  ) {
    throw new Error("The deterministic local E2E inventory fixtures were not prepared.");
  }
}
