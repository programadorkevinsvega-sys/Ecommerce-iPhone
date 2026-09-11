import type { AddressProps, Customer, CustomerProps } from "../domain/Customer";
import type { CustomerRepository } from "./CustomerRepository";

export class CustomerManagement {
  constructor(private readonly repository: CustomerRepository) {}

  async get(id: string): Promise<Readonly<{ customer: Customer | null; addresses: readonly unknown[] }>> {
    const customer = await this.repository.findById(id);
    if (!customer) return { customer: null, addresses: [] };
    return { customer, addresses: await this.repository.listAddresses(id) };
  }

  async save(input: CustomerProps, address?: AddressProps): Promise<Readonly<{ customer: Customer; addresses: readonly unknown[] }>> {
    const customer = await this.repository.save(input);
    if (address) await this.repository.addAddress(customer.getId(), address);
    return { customer, addresses: await this.repository.listAddresses(customer.getId()) };
  }
}
