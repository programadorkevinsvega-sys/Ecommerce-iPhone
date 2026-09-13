import type { D1Database } from "@cloudflare/workers-types";
import type { AdminCustomer, AdminCustomerRepository } from "../application/AdminCustomerManagement";

export class D1AdminCustomerRepository implements AdminCustomerRepository {
  constructor(private readonly db: D1Database) {}

  async list(query: string): Promise<readonly AdminCustomer[]> {
    const pattern = `%${query}%`;
    const result = await this.db.prepare(
      "SELECT id,email,first_name AS firstName,last_name AS lastName,phone,created_at AS createdAt,updated_at AS updatedAt FROM customers WHERE (?='' OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?) ORDER BY created_at DESC LIMIT 100",
    ).bind(query, pattern, pattern, pattern, pattern).all<AdminCustomer>();
    return result.results;
  }

  async update(id: string, input: { firstName: string; lastName: string; phone: string | null }): Promise<void> {
    const result = await this.db.prepare(
      "UPDATE customers SET first_name=?,last_name=?,phone=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).bind(input.firstName, input.lastName, input.phone, id).run();
    if (result.meta.changes !== 1) throw new Error("CUSTOMER_NOT_FOUND");
  }

  async delete(id: string): Promise<void> {
    const result = await this.db.prepare("DELETE FROM customers WHERE id=?").bind(id).run();
    if (result.meta.changes !== 1) throw new Error("CUSTOMER_NOT_FOUND");
  }
}
