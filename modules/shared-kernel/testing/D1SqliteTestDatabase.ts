import { DatabaseSync } from "node:sqlite";
import type { D1Database } from "@cloudflare/workers-types";

type BoundStatement = { sql: string; params: unknown[] };

class TestStatement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]): TestStatement {
    return new TestStatement(this.db, this.sql, params);
  }

  first<T>(): T | null {
    const row = this.db.prepare(this.sql).get(...this.params);
    return row ? (row as T) : null;
  }

  all<T>(): { results: T[] } {
    return { results: this.db.prepare(this.sql).all(...this.params) as T[] };
  }

  run(): { meta: { changes: number; last_row_id: number } } {
    const result = this.db.prepare(this.sql).run(...this.params);
    return { meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }

  descriptor(): BoundStatement {
    return { sql: this.sql, params: this.params };
  }
}

export class D1SqliteTestDatabase {
  private readonly db = new DatabaseSync(":memory:");

  constructor() {
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE products (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL, active INTEGER NOT NULL,
        price_in_cents INTEGER NOT NULL, currency TEXT NOT NULL, stock INTEGER NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE carts (
        id TEXT PRIMARY KEY, customer_id TEXT, currency TEXT NOT NULL
      );
      CREATE TABLE cart_items (
        cart_id TEXT NOT NULL, product_id TEXT NOT NULL, quantity INTEGER NOT NULL,
        unit_price_in_cents INTEGER NOT NULL, PRIMARY KEY (cart_id, product_id),
        FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
      CREATE TABLE checkout_idempotency (
        idempotency_key TEXT PRIMARY KEY, customer_id TEXT NOT NULL,
        order_id TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL
      );
      CREATE TABLE checkout_guards (id INTEGER PRIMARY KEY CHECK (id = 1));
      INSERT INTO checkout_guards(id) VALUES (1);
      CREATE TABLE orders (
        id TEXT PRIMARY KEY, order_number TEXT NOT NULL UNIQUE, customer_id TEXT, email TEXT NOT NULL,
        status TEXT NOT NULL, currency TEXT NOT NULL, subtotal_in_cents INTEGER NOT NULL,
        shipping_in_cents INTEGER NOT NULL, discount_in_cents INTEGER NOT NULL, total_in_cents INTEGER NOT NULL,
        shipping_method TEXT NOT NULL, shipping_recipient_name TEXT NOT NULL, shipping_phone TEXT NOT NULL,
        shipping_address_line1 TEXT NOT NULL, shipping_address_line2 TEXT, shipping_city TEXT NOT NULL,
        shipping_state TEXT NOT NULL, shipping_postal_code TEXT, shipping_country_code TEXT NOT NULL
      );
      CREATE TABLE order_items (
        id TEXT PRIMARY KEY, order_id TEXT NOT NULL, product_id TEXT NOT NULL, variant_id TEXT,
        product_name TEXT NOT NULL, product_slug TEXT NOT NULL, quantity INTEGER NOT NULL,
        unit_price_in_cents INTEGER NOT NULL, line_total_in_cents INTEGER NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
      CREATE TABLE order_events (
        id TEXT PRIMARY KEY, order_id TEXT NOT NULL, event_type TEXT NOT NULL, payload_json TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      );
      CREATE TABLE inventory_reservations (
        id TEXT PRIMARY KEY, cart_id TEXT NOT NULL, product_id TEXT NOT NULL, quantity INTEGER NOT NULL,
        expires_at TEXT NOT NULL, released_at TEXT, order_id TEXT,
        FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `);
  }

  prepare(sql: string): TestStatement {
    return new TestStatement(this.db, sql);
  }

  batch(statements: TestStatement[]): readonly { meta: { changes: number; last_row_id: number } }[] {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) => this.execute(statement.descriptor()));
      this.db.exec("COMMIT");
      return results;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  asD1(): D1Database {
    return this as unknown as D1Database;
  }

  close(): void {
    this.db.close();
  }

  exec(sql: string, ...params: unknown[]): void {
    if (params.length === 0) {
      this.db.exec(sql);
      return;
    }
    this.db.prepare(sql).run(...params);
  }

  query<T>(sql: string, ...params: unknown[]): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  private execute(statement: BoundStatement): { meta: { changes: number; last_row_id: number } } {
    const result = this.db.prepare(statement.sql).run(...statement.params);
    return { meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }
}
