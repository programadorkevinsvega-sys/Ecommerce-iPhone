import type { D1Database } from "@cloudflare/workers-types";
import { Customer, Address, type CustomerProps, type AddressProps } from "../domain/Customer";
import type { CustomerAddressRepository } from "../application/CustomerAddressRepository";

export class D1CustomerRepository implements CustomerAddressRepository {
  constructor(private readonly db: D1Database) {}

  private hydrate(row: any) {
    return Customer.create(row.id, { email: row.email, firstName: row.first_name, lastName: row.last_name, phone: row.phone ?? undefined });
  }

  private hydrateAddress(row: any) {
    return Address.create(row.id, {
      label: row.label,
      recipientName: row.recipient_name,
      phone: row.phone,
      addressLine1: row.address_line1,
      addressLine2: row.address_line2 ?? undefined,
      city: row.city,
      state: row.state,
      postalCode: row.postal_code ?? undefined,
      countryCode: row.country_code,
      isDefault: Boolean(row.is_default),
    });
  }

  async findById(id: string): Promise<Customer | null> {
    const row = await this.db.prepare("SELECT id,email,first_name,last_name,phone FROM customers WHERE id=?").bind(id).first<any>();
    return row ? this.hydrate(row) : null;
  }

  async findByEmail(email: string): Promise<Customer | null> {
    const row = await this.db.prepare("SELECT id,email,first_name,last_name,phone FROM customers WHERE email=? COLLATE NOCASE LIMIT 1").bind(email).first<any>();
    return row ? this.hydrate(row) : null;
  }

  async save(props: CustomerProps): Promise<Customer> {
    const existing = await this.findByEmail(props.email);
    if (existing) return existing;
    const id = crypto.randomUUID();
    await this.db.prepare("INSERT INTO customers(id,email,first_name,last_name,phone) VALUES(?,?,?,?,?)").bind(id, props.email, props.firstName, props.lastName, props.phone ?? null).run();
    return Customer.create(id, props);
  }

  async addAddress(customerId: string, props: AddressProps): Promise<Address> {
    const id = crypto.randomUUID();
    const statements: any[] = [];
    if (props.isDefault) statements.push(this.db.prepare("UPDATE customer_addresses SET is_default=0,updated_at=CURRENT_TIMESTAMP WHERE customer_id=?").bind(customerId));
    statements.push(this.db.prepare("INSERT INTO customer_addresses(id,customer_id,label,recipient_name,phone,address_line1,address_line2,city,state,postal_code,country_code,is_default) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(id, customerId, props.label, props.recipientName, props.phone, props.addressLine1, props.addressLine2 ?? null, props.city, props.state, props.postalCode ?? null, props.countryCode, props.isDefault ? 1 : 0));
    await this.db.batch(statements);
    return Address.create(id, props);
  }

  async findAddress(customerId: string, id: string): Promise<Address | null> {
    const row = await this.db.prepare("SELECT id,label,recipient_name,phone,address_line1,address_line2,city,state,postal_code,country_code,is_default FROM customer_addresses WHERE id=? AND customer_id=? LIMIT 1").bind(id, customerId).first<any>();
    return row ? this.hydrateAddress(row) : null;
  }

  async updateAddress(customerId: string, id: string, props: AddressProps): Promise<Address> {
    const statements: any[] = [];
    if (props.isDefault) statements.push(this.db.prepare("UPDATE customer_addresses SET is_default=0,updated_at=CURRENT_TIMESTAMP WHERE customer_id=? AND id<>?").bind(customerId, id));
    statements.push(this.db.prepare("UPDATE customer_addresses SET label=?,recipient_name=?,phone=?,address_line1=?,address_line2=?,city=?,state=?,postal_code=?,country_code=?,is_default=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND customer_id=?").bind(props.label, props.recipientName, props.phone, props.addressLine1, props.addressLine2 ?? null, props.city, props.state, props.postalCode ?? null, props.countryCode, props.isDefault ? 1 : 0, id, customerId));
    await this.db.batch(statements);
    const updated = await this.findAddress(customerId, id);
    if (!updated) throw new Error("ADDRESS_NOT_FOUND");
    return updated;
  }

  async deleteAddress(customerId: string, id: string): Promise<boolean> {
    const result = await this.db.prepare("DELETE FROM customer_addresses WHERE id=? AND customer_id=?").bind(id, customerId).run();
    return result.meta.changes === 1;
  }

  async listAddresses(customerId: string): Promise<readonly Address[]> {
    const rows = await this.db.prepare("SELECT id,label,recipient_name,phone,address_line1,address_line2,city,state,postal_code,country_code,is_default FROM customer_addresses WHERE customer_id=? ORDER BY is_default DESC,created_at DESC").bind(customerId).all<any>();
    return rows.results.map(row => this.hydrateAddress(row));
  }

  async findAccountByEmail(email: string) { return this.db.prepare("SELECT id,email,first_name,last_name,phone,whatsapp,country_code,password_hash FROM customers WHERE email=? COLLATE NOCASE LIMIT 1").bind(email).first<any>(); }
  async findAccountById(id: string) { return this.db.prepare("SELECT id,email,first_name,last_name,phone,whatsapp,country_code,password_hash FROM customers WHERE id=? LIMIT 1").bind(id).first<any>(); }
  async createAccount(input: { email: string; firstName: string; lastName: string; phone: string; whatsapp: string; countryCode: string; passwordHash: string }) { const id = crypto.randomUUID(); await this.db.prepare("INSERT INTO customers(id,email,first_name,last_name,phone,whatsapp,country_code,password_hash) VALUES(?,?,?,?,?,?,?,?)").bind(id,input.email,input.firstName,input.lastName,input.phone||null,input.whatsapp||null,input.countryCode,input.passwordHash).run(); return id; }
  async updateAccount(id: string,input:{firstName:string;lastName:string;phone:string;whatsapp:string;countryCode:string}){await this.db.prepare("UPDATE customers SET first_name=?,last_name=?,phone=?,whatsapp=?,country_code=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(input.firstName,input.lastName,input.phone||null,input.whatsapp||null,input.countryCode,id).run();}
  async setPassword(id:string,passwordHash:string){await this.db.prepare("UPDATE customers SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(passwordHash,id).run();}
  async createPasswordReset(id:string,tokenHash:string,expiresAt:string){await this.db.prepare("UPDATE customer_password_resets SET used_at=CURRENT_TIMESTAMP WHERE customer_id=? AND used_at IS NULL").bind(id).run();await this.db.prepare("INSERT INTO customer_password_resets(id,customer_id,token_hash,expires_at) VALUES(?,?,?,?)").bind(crypto.randomUUID(),id,tokenHash,expiresAt).run();}
  async consumePasswordReset(tokenHash:string){const row=await this.db.prepare("SELECT id,customer_id FROM customer_password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at>CURRENT_TIMESTAMP LIMIT 1").bind(tokenHash).first<any>();if(!row)return null;const result=await this.db.prepare("UPDATE customer_password_resets SET used_at=CURRENT_TIMESTAMP WHERE id=? AND used_at IS NULL").bind(row.id).run();return result.meta.changes===1?String(row.customer_id):null;}
}
