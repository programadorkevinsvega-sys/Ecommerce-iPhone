import type { CustomerAccountRepository, CustomerAccountRow } from "./CustomerAccountRepository";
import { hashCustomerPassword, hashCustomerToken, verifyCustomerPassword } from "../infrastructure/CustomerPasswordSecurity";

export type CustomerAccount = Readonly<{ id:string; email:string; firstName:string; lastName:string; phone:string|null; whatsapp:string|null; countryCode:string }>;

function account(row: CustomerAccountRow): CustomerAccount {
  return { id: row.id, email: row.email, firstName: row.first_name, lastName: row.last_name, phone: row.phone, whatsapp: row.whatsapp, countryCode: row.country_code || "CO" };
}
function text(value: unknown, max: number): string { return String(value ?? "").replace(/[\u0000-\u001F\u007F]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, max); }
function email(value: unknown): string { const normalized = text(value, 254).toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new Error("INVALID_EMAIL"); return normalized; }
function password(value: unknown): string { const result = String(value ?? ""); if (result.length < 12 || result.length > 128) throw new Error("INVALID_PASSWORD"); return result; }

export class CustomerAccountService {
  constructor(private readonly repository: CustomerAccountRepository) {}
  async register(input: Record<string, unknown>): Promise<CustomerAccount> { const normalized = email(input.email); const firstName = text(input.firstName, 80), lastName = text(input.lastName, 80); if (!firstName || !lastName) throw new Error("INVALID_NAME"); if (await this.repository.findAccountByEmail(normalized)) throw new Error("CUSTOMER_ALREADY_EXISTS"); const id = await this.repository.createAccount({ email: normalized, firstName, lastName, phone: text(input.phone, 25), whatsapp: text(input.whatsapp, 25), countryCode: text(input.countryCode || "CO", 2).toUpperCase(), passwordHash: await hashCustomerPassword(password(input.password)) }); const row = await this.repository.findAccountById(id); if (!row) throw new Error("CUSTOMER_NOT_FOUND"); return account(row); }
  async authenticate(input: Record<string, unknown>): Promise<CustomerAccount | null> { const row = await this.repository.findAccountByEmail(email(input.email)); const valid = await verifyCustomerPassword(password(input.password), row?.password_hash ?? null); if (!row || !valid) return null; return account(row); }
  async profile(id: string, input: Record<string, unknown>): Promise<CustomerAccount> { const firstName = text(input.firstName, 80), lastName = text(input.lastName, 80), countryCode = text(input.countryCode || "CO", 2).toUpperCase(); if (!firstName || !lastName || !/^[A-Z]{2}$/.test(countryCode)) throw new Error("INVALID_PROFILE"); await this.repository.updateAccount(id, { firstName, lastName, phone: text(input.phone, 25), whatsapp: text(input.whatsapp, 25), countryCode }); const row = await this.repository.findAccountById(id); if (!row) throw new Error("CUSTOMER_NOT_FOUND"); return account(row); }
  async requestPasswordReset(input: Record<string, unknown>): Promise<Readonly<{ email: string; token: string }> | null> { const normalized = email(input.email); const row = await this.repository.findAccountByEmail(normalized); if (!row) return null; const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", ""); await this.repository.createPasswordReset(row.id, await hashCustomerToken(token), new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ")); return { email: normalized, token }; }
  async resetPassword(input: Record<string, unknown>): Promise<string> { const token = text(input.token, 128); if (!/^[A-Za-z0-9]{40,80}$/.test(token)) throw new Error("INVALID_RESET"); const id = await this.repository.consumePasswordReset(await hashCustomerToken(token)); if (!id) throw new Error("INVALID_RESET"); await this.repository.setPassword(id, await hashCustomerPassword(password(input.password))); return id; }
}
