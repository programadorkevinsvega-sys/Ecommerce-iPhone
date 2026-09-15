import { describe, expect, it } from "vitest";
import type { CustomerAccountRepository, CustomerAccountRow } from "./CustomerAccountRepository";
import { CustomerAccountService } from "./CustomerAccountService";

class InMemoryCustomerAccounts implements CustomerAccountRepository {
  private readonly rows = new Map<string, CustomerAccountRow>();
  private readonly resets = new Map<string, { customerId: string; expiresAt: string; used: boolean }>();

  async findAccountByEmail(email: string) { return [...this.rows.values()].find(row => row.email.toLowerCase() === email.toLowerCase()) ?? null; }
  async findAccountById(id: string) { return this.rows.get(id) ?? null; }
  async createAccount(input: { email: string; firstName: string; lastName: string; phone: string; whatsapp: string; countryCode: string; passwordHash: string }) {
    const id = crypto.randomUUID();
    this.rows.set(id, { id, email: input.email, first_name: input.firstName, last_name: input.lastName, phone: input.phone || null, whatsapp: input.whatsapp || null, country_code: input.countryCode, password_hash: input.passwordHash });
    return id;
  }
  async updateAccount(id: string, input: { firstName: string; lastName: string; phone: string; whatsapp: string; countryCode: string }) {
    const row = this.rows.get(id);
    if (!row) return;
    this.rows.set(id, { ...row, first_name: input.firstName, last_name: input.lastName, phone: input.phone || null, whatsapp: input.whatsapp || null, country_code: input.countryCode });
  }
  async setPassword(id: string, passwordHash: string) { const row = this.rows.get(id); if (row) this.rows.set(id, { ...row, password_hash: passwordHash }); }
  async createPasswordReset(id: string, tokenHash: string, expiresAt: string) { this.resets.set(tokenHash, { customerId: id, expiresAt, used: false }); }
  async consumePasswordReset(tokenHash: string) { const reset = this.resets.get(tokenHash); if (!reset || reset.used || new Date(reset.expiresAt) <= new Date()) return null; reset.used = true; return reset.customerId; }
}

describe("CustomerAccountService", () => {
  it("normalizes the email and stores only a password hash", async () => {
    const repository = new InMemoryCustomerAccounts();
    const service = new CustomerAccountService(repository);
    const customer = await service.register({ email: "  USER@Example.COM ", firstName: "Ana", lastName: "Vega", countryCode: "co", password: "una-contraseña-segura" });
    const row = await repository.findAccountById(customer.id);
    expect(customer.email).toBe("user@example.com");
    expect(row?.password_hash).toBeTruthy();
    expect(row?.password_hash).not.toBe("una-contraseña-segura");
  });

  it("rejects duplicate normalized emails", async () => {
    const service = new CustomerAccountService(new InMemoryCustomerAccounts());
    await service.register({ email: "USER@example.com", firstName: "Ana", lastName: "Vega", password: "una-contraseña-segura" });
    await expect(service.register({ email: " user@EXAMPLE.com ", firstName: "Otra", lastName: "Persona", password: "una-contraseña-segura" })).rejects.toThrow("CUSTOMER_ALREADY_EXISTS");
  });

  it("authenticates with the original password and rejects an invalid password", async () => {
    const repository = new InMemoryCustomerAccounts();
    const service = new CustomerAccountService(repository);
    await service.register({ email: "user@example.com", firstName: "Ana", lastName: "Vega", password: "una-contraseña-segura" });
    expect((await service.authenticate({ email: "USER@example.com", password: "una-contraseña-segura" }))?.email).toBe("user@example.com");
    expect(await service.authenticate({ email: "USER@example.com", password: "otra-contraseña" })).toBeNull();
  });

  it("updates profile fields and preserves account ownership", async () => {
    const repository = new InMemoryCustomerAccounts();
    const service = new CustomerAccountService(repository);
    const customer = await service.register({ email: "user@example.com", firstName: "Ana", lastName: "Vega", password: "una-contraseña-segura" });
    const updated = await service.profile(customer.id, { firstName: "María", lastName: "Vega", phone: "+573001112233", whatsapp: "+573001112233", countryCode: "CO" });
    expect(updated.id).toBe(customer.id);
    expect(updated.firstName).toBe("María");
  });
});
