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

export function cleanupLocalCommerceFixtures(
  emails: readonly string[],
  cartIds: readonly string[],
): void {
  const uniqueEmails = [...new Set(emails)];
  const uniqueCartIds = [...new Set(cartIds)];

  if (uniqueEmails.length > 0) {
    const emailList = uniqueEmails.map(sqlLiteral).join(", ");
    const orderIds = queryLocalD1<{ id: string }>(
      `SELECT id FROM orders WHERE email IN (${emailList})`,
    ).map((row) => row.id);
    const orderIdList = orderIds.map(sqlLiteral).join(", ") || "''";
    const outboxIds = queryLocalD1<{ id: string }>(
      `SELECT id FROM notification_outbox WHERE aggregate_id IN (${orderIdList})`,
    ).map((row) => row.id);
    const outboxIdList = outboxIds.map(sqlLiteral).join(", ") || "''";

    if (outboxIds.length > 0) {
      executeLocalD1(
        `DELETE FROM notification_channel_deliveries
         WHERE notification_id IN (
           SELECT id FROM notification_inbox WHERE event_id IN (${outboxIdList})
         )`,
      );
      executeLocalD1(
        `DELETE FROM notification_inbox WHERE event_id IN (${outboxIdList})`,
      );
      executeLocalD1(
        `DELETE FROM notification_deliveries WHERE outbox_id IN (${outboxIdList})`,
      );
      executeLocalD1(
        `DELETE FROM notification_outbox WHERE id IN (${outboxIdList})`,
      );
    }

    if (orderIds.length > 0) {
      executeLocalD1(
        `DELETE FROM inventory_reservations WHERE order_id IN (${orderIdList})`,
      );
      executeLocalD1(
        `DELETE FROM coupon_redemptions WHERE order_id IN (${orderIdList})`,
      );
      executeLocalD1(`DELETE FROM order_events WHERE order_id IN (${orderIdList})`);
      executeLocalD1(`DELETE FROM order_items WHERE order_id IN (${orderIdList})`);
      executeLocalD1(`DELETE FROM orders WHERE id IN (${orderIdList})`);
    }

    executeLocalD1(
      `DELETE FROM checkout_idempotency
       WHERE customer_id IN (SELECT id FROM customers WHERE email IN (${emailList}))`,
    );
    executeLocalD1(`DELETE FROM customers WHERE email IN (${emailList})`);

    const remaining = queryLocalD1<{
      customers: number;
      orders: number;
      outbox: number;
      deliveries: number;
    }>(
      `SELECT
        (SELECT COUNT(*) FROM customers WHERE email IN (${emailList})) AS customers,
        (SELECT COUNT(*) FROM orders WHERE id IN (${orderIdList})) AS orders,
        (SELECT COUNT(*) FROM notification_outbox WHERE id IN (${outboxIdList})) AS outbox,
        (SELECT COUNT(*) FROM notification_deliveries WHERE outbox_id IN (${outboxIdList})) AS deliveries`,
    )[0];

    if (
      remaining.customers !== 0 ||
      remaining.orders !== 0 ||
      remaining.outbox !== 0 ||
      remaining.deliveries !== 0
    ) {
      throw new Error("The local E2E order/customer cleanup left residual rows.");
    }
  }

  if (uniqueCartIds.length > 0) {
    const cartList = uniqueCartIds.map(sqlLiteral).join(", ");
    executeLocalD1(
      `DELETE FROM inventory_reservations WHERE cart_id IN (${cartList})`,
    );
    executeLocalD1(`DELETE FROM cart_items WHERE cart_id IN (${cartList})`);
    executeLocalD1(`DELETE FROM carts WHERE id IN (${cartList})`);

    const remaining = queryLocalD1<{ count: number }>(
      `SELECT COUNT(*) AS count FROM carts WHERE id IN (${cartList})`,
    )[0]?.count;
    if (remaining !== 0) {
      throw new Error("The local E2E cart cleanup left residual rows.");
    }
  }
}
