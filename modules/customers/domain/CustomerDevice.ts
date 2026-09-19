import { DomainError } from "../../shared-kernel";

export type CustomerDeviceProps = Readonly<{
  customerId: string;
  deviceType: string;
  brand: string;
  model: string;
  serialLast4: string | null;
  imeiLast4: string | null;
  color: string | null;
  capacity: string | null;
  physicalCondition: string | null;
  notes: string | null;
}>;

const DEVICE_TYPES = new Set(["PHONE", "TABLET", "LAPTOP", "WATCH", "OTHER"]);

function required(value: string, field: string, max: number): string {
  const normalized = value.replace(/[\u0000-\u001F\u007F]/gu, " ").replace(/\s+/gu, " ").trim();
  if (!normalized || normalized.length > max) throw new DomainError(`Invalid device ${field}`);
  return normalized;
}

function optional(value: string | null, max: number): string | null {
  if (value === null) return null;
  const normalized = value.replace(/[\u0000-\u001F\u007F]/gu, " ").replace(/\s+/gu, " ").trim();
  return normalized ? normalized.slice(0, max) : null;
}

function last4(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  if (normalized && !/^[A-Za-z0-9]{4}$/.test(normalized)) throw new DomainError("Invalid protected identifier");
  return normalized || null;
}

export class CustomerDevice {
  private constructor(private readonly id: string, private readonly props: CustomerDeviceProps) {}

  static create(id: string, props: CustomerDeviceProps): CustomerDevice {
    if (!id.trim() || !props.customerId.trim()) throw new DomainError("Device identity is required");
    if (!DEVICE_TYPES.has(props.deviceType)) throw new DomainError("Invalid device type");
    const normalized: CustomerDeviceProps = {
      customerId: props.customerId,
      deviceType: props.deviceType,
      brand: required(props.brand, "brand", 60),
      model: required(props.model, "model", 100),
      serialLast4: last4(props.serialLast4),
      imeiLast4: last4(props.imeiLast4),
      color: optional(props.color, 60),
      capacity: optional(props.capacity, 40),
      physicalCondition: optional(props.physicalCondition, 1000),
      notes: optional(props.notes, 1000),
    };
    return new CustomerDevice(id, normalized);
  }

  getId(): string { return this.id; }
  getCustomerId(): string { return this.props.customerId; }
  toPrimitives(): CustomerDeviceProps & { id: string } { return { id: this.id, ...this.props }; }
}
