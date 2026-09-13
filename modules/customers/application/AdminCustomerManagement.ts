export type AdminCustomer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminCustomerRepository = {
  list(query: string): Promise<readonly AdminCustomer[]>;
  update(id: string, input: { firstName: string; lastName: string; phone: string | null }): Promise<void>;
  delete(id: string): Promise<void>;
};

const MAX_QUERY = 100;
const MAX_NAME = 80;
const MAX_PHONE = 25;

function text(value: unknown, max: number): string {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/gu, "").replace(/\s+/gu, " ").trim().slice(0, max);
}

export class AdminCustomerManagement {
  constructor(private readonly repository: AdminCustomerRepository) {}

  list(query: unknown): Promise<readonly AdminCustomer[]> {
    return this.repository.list(text(query, MAX_QUERY));
  }

  async update(id: unknown, input: Record<string, unknown>): Promise<void> {
    const customerId = text(id, 128);
    const firstName = text(input.firstName, MAX_NAME);
    const lastName = text(input.lastName, MAX_NAME);
    const rawPhone = text(input.phone, MAX_PHONE);
    if (!customerId || !firstName || !lastName || firstName.length > MAX_NAME || lastName.length > MAX_NAME) {
      throw new Error("INVALID_CUSTOMER_DATA");
    }
    if (rawPhone && !/^[+()\d][\d\s().-]{6,24}$/u.test(rawPhone)) throw new Error("INVALID_CUSTOMER_PHONE");
    await this.repository.update(customerId, { firstName, lastName, phone: rawPhone || null });
  }

  async delete(id: unknown): Promise<void> {
    const customerId = text(id, 128);
    if (!customerId) throw new Error("INVALID_CUSTOMER_DATA");
    await this.repository.delete(customerId);
  }
}
