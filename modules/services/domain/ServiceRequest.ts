import { AggregateRoot, DomainError } from "../../shared-kernel";

export type ServiceType = string;
export type ServiceRequestStatus = "PENDING" | "QUOTED" | "PAYMENT_PENDING" | "PAID" | "PROCESSING" | "WAITING_CUSTOMER" | "COMPLETED" | "REJECTED" | "REFUNDED";

export type ServiceRequestProps = Readonly<{
  customerId?: string;
  email: string;
  type: ServiceType;
  deviceBrand: string;
  deviceModel: string;
  deviceSerialLast4?: string;
  imeiLast4?: string;
  carrier?: string;
  problemDescription: string;
  customerNotes?: string;
  status: ServiceRequestStatus;
  quoteInCents?: number;
  currency: string;
  paymentId?: string;
  assignedTechnicianId?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}>;

const transitions: Record<ServiceRequestStatus, readonly ServiceRequestStatus[]> = {
  PENDING: ["QUOTED", "REJECTED"], QUOTED: ["PAYMENT_PENDING", "REJECTED"],
  PAYMENT_PENDING: ["PAID", "REJECTED"], PAID: ["PROCESSING", "REFUNDED"],
  PROCESSING: ["WAITING_CUSTOMER", "COMPLETED", "REJECTED"], WAITING_CUSTOMER: ["PROCESSING", "COMPLETED", "REJECTED"],
  COMPLETED: [], REJECTED: ["REFUNDED"], REFUNDED: []
};

export class ServiceRequest extends AggregateRoot<string> {
  private constructor(id: string, private props: ServiceRequestProps) { super(id); }
  static create(id: string, props: Omit<ServiceRequestProps, "status" | "createdAt" | "updatedAt"> & Partial<Pick<ServiceRequestProps, "status" | "createdAt" | "updatedAt">>): ServiceRequest {
    if (!props.email.includes("@")) throw new DomainError("Valid email is required");
    if (!props.type.trim()) throw new DomainError("Service type is required");
    if (!props.deviceBrand.trim() || !props.deviceModel.trim()) throw new DomainError("Device brand and model are required");
    if (!props.problemDescription.trim()) throw new DomainError("Problem description is required");
    if (props.type === "CARRIER_UNLOCK" && !props.carrier?.trim()) throw new DomainError("Carrier is required for an unlock request");
    if (props.quoteInCents !== undefined && props.quoteInCents < 0) throw new DomainError("Quote cannot be negative");
    const now = new Date().toISOString();
    return new ServiceRequest(id, { ...props, status: props.status ?? "PENDING", currency: props.currency || "COP", createdAt: props.createdAt ?? now, updatedAt: props.updatedAt ?? now });
  }
  transitionTo(status: ServiceRequestStatus): void {
    if (status !== this.props.status && !transitions[this.props.status].includes(status)) throw new DomainError(`Invalid service transition ${this.props.status} -> ${status}`);
    this.props = { ...this.props, status, updatedAt: new Date().toISOString() };
  }
  quote(amountInCents: number): void { if (amountInCents < 0) throw new DomainError("Quote cannot be negative"); if (this.props.status !== "PENDING") throw new DomainError("Only pending requests can be quoted"); this.props = { ...this.props, quoteInCents: amountInCents, status: "QUOTED", updatedAt: new Date().toISOString() }; }
  assign(technicianId: string): void { if (!technicianId.trim()) throw new DomainError("Technician is required"); this.props = { ...this.props, assignedTechnicianId: technicianId, updatedAt: new Date().toISOString() }; }
  attachPayment(paymentId: string): void { if (!paymentId.trim()) throw new DomainError("Payment is required"); this.props = { ...this.props, paymentId, updatedAt: new Date().toISOString() }; }
  resolve(notes: string): void { if (!notes.trim()) throw new DomainError("Resolution notes are required"); this.props = { ...this.props, resolutionNotes: notes.trim(), status: "COMPLETED", updatedAt: new Date().toISOString() }; }
  toPrimitives(): ServiceRequestProps & { id: string } { return { id: this.getId(), ...this.props, deviceSerialLast4: this.props.deviceSerialLast4, imeiLast4: this.props.imeiLast4 }; }
}

export const SERVICE_CATALOG = [
  { type: "CARRIER_UNLOCK", slug: "desbloqueo-operador", name: "Desbloqueo de operador", description: "Gestión de solicitudes de desbloqueo autorizadas por el operador y el propietario." },
  { type: "DIAGNOSTIC", slug: "diagnostico", name: "Diagnóstico de dispositivo", description: "Evaluación técnica de hardware, batería, conectividad y software." },
  { type: "REPAIR", slug: "reparacion", name: "Reparación", description: "Solicitud de reparación y presupuesto." },
  { type: "CONFIGURATION", slug: "configuracion", name: "Configuración", description: "Configuración, transferencia de datos y puesta a punto." }
] as const;
