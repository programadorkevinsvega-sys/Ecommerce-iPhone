import { Address, type AddressProps } from "../domain/Customer";
import type { CustomerAddressRepository } from "./CustomerAddressRepository";

function text(value: unknown, max: number): string {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, max);
}

function props(input: Record<string, unknown>): AddressProps {
  const countryCode = text(input.countryCode || "CO", 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error("INVALID_ADDRESS");
  const result: AddressProps = {
    label: text(input.label || "Principal", 60),
    recipientName: text(input.recipientName, 120),
    phone: text(input.phone, 25),
    addressLine1: text(input.addressLine1, 180),
    addressLine2: text(input.addressLine2, 180) || undefined,
    city: text(input.city, 80),
    state: text(input.state, 80),
    postalCode: text(input.postalCode, 20) || undefined,
    countryCode,
    isDefault: Boolean(input.isDefault),
  };
  return result;
}

export class CustomerAddressService {
  constructor(private readonly repository: CustomerAddressRepository) {}

  async list(customerId: string) {
    return this.repository.listAddresses(customerId);
  }

  async create(customerId: string, input: Record<string, unknown>) {
    const value = props(input);
    return this.repository.addAddress(customerId, value);
  }

  async update(customerId: string, id: string, input: Record<string, unknown>) {
    const current = await this.repository.findAddress(customerId, id);
    if (!current) throw new Error("ADDRESS_NOT_FOUND");
    return this.repository.updateAddress(customerId, id, props(input));
  }

  async remove(customerId: string, id: string) {
    const removed = await this.repository.deleteAddress(customerId, id);
    if (!removed) throw new Error("ADDRESS_NOT_FOUND");
  }

  static assertDomain(address: Address): Address {
    return address;
  }
}
