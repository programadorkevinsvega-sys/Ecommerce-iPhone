import type { Address, AddressProps, Customer, CustomerProps } from "../domain/Customer";

export interface CustomerRepository {
  findById(id: string): Promise<Customer | null>;
  save(props: CustomerProps): Promise<Customer>;
  addAddress(customerId: string, props: AddressProps): Promise<Address>;
  listAddresses(customerId: string): Promise<readonly Address[]>;
}
