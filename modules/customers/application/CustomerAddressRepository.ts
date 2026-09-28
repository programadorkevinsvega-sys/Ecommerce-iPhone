import type { Address, AddressProps } from "../domain/Customer";

export interface CustomerAddressRepository {
  listAddresses(customerId: string): Promise<readonly Address[]>;
  addAddress(customerId: string, props: AddressProps): Promise<Address>;
  findAddress(customerId: string, id: string): Promise<Address | null>;
  updateAddress(customerId: string, id: string, props: AddressProps): Promise<Address>;
  deleteAddress(customerId: string, id: string): Promise<boolean>;
}
