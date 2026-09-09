import { DomainError, ValueObject } from "../../shared-kernel";

export type ServiceCategory = "DEVICE" | "NETWORK" | "SOFTWARE" | "REPAIR" | "OTHER";

export type ServiceWorkflow = Readonly<{
  initialStatus: "PENDING";
  quoteRequired: boolean;
  paymentRequired: boolean;
  technicianApprovalRequired: boolean;
  adminApprovalRequired: boolean;
  customerOwnershipProofRequired: boolean;
  allowedStatuses: readonly string[];
}>;

export type ServiceTypeDefinitionProps = Readonly<{
  code: string;
  slug: string;
  name: string;
  description: string;
  category: ServiceCategory;
  workflow: ServiceWorkflow;
  enabled: boolean;
  metadata: Readonly<Record<string, string>>;
  createdAt: string;
  updatedAt: string;
}>;

export class ServiceTypeDefinition extends ValueObject<ServiceTypeDefinitionProps> {
  private constructor(props: ServiceTypeDefinitionProps) { super(props); }

  static create(props: Omit<ServiceTypeDefinitionProps, "createdAt" | "updatedAt"> & Partial<Pick<ServiceTypeDefinitionProps, "createdAt" | "updatedAt">>): ServiceTypeDefinition {
    if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(props.code)) throw new DomainError("Invalid service type code");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(props.slug)) throw new DomainError("Invalid service type slug");
    if (!props.name.trim()) throw new DomainError("Service type name is required");
    if (!props.description.trim()) throw new DomainError("Service type description is required");
    if (!props.workflow) throw new DomainError("Service workflow is required");
    if (!props.workflow.allowedStatuses.includes("PENDING")) throw new DomainError("Service workflow must allow PENDING");
    const now = new Date().toISOString();
    return new ServiceTypeDefinition({ ...props, name: props.name.trim(), description: props.description.trim(), createdAt: props.createdAt ?? now, updatedAt: props.updatedAt ?? now });
  }

  toPrimitives(): ServiceTypeDefinitionProps { return this.props; }
}

export const DEFAULT_SERVICE_TYPES: ReadonlyArray<Omit<ServiceTypeDefinitionProps, "createdAt" | "updatedAt">> = [
  { code: "CARRIER_UNLOCK", slug: "desbloqueo-operador", name: "Desbloqueo de operador", description: "Gestión de solicitudes de desbloqueo autorizadas por el operador y el propietario.", category: "NETWORK", enabled: true, workflow: { initialStatus: "PENDING", quoteRequired: true, paymentRequired: true, technicianApprovalRequired: true, adminApprovalRequired: false, customerOwnershipProofRequired: true, allowedStatuses: ["PENDING", "QUOTED", "PAYMENT_PENDING", "PAID", "PROCESSING", "WAITING_CUSTOMER", "COMPLETED", "REJECTED", "REFUNDED"] }, metadata: {} },
  { code: "DIAGNOSTIC", slug: "diagnostico", name: "Diagnóstico de dispositivo", description: "Evaluación técnica de hardware, batería, conectividad y software.", category: "DEVICE", enabled: true, workflow: { initialStatus: "PENDING", quoteRequired: false, paymentRequired: false, technicianApprovalRequired: false, adminApprovalRequired: false, customerOwnershipProofRequired: false, allowedStatuses: ["PENDING", "PAID", "PROCESSING", "WAITING_CUSTOMER", "COMPLETED", "REJECTED", "REFUNDED"] }, metadata: {} },
  { code: "REPAIR", slug: "reparacion", name: "Reparación", description: "Solicitud de reparación y presupuesto para fallas de hardware o software.", category: "REPAIR", enabled: true, workflow: { initialStatus: "PENDING", quoteRequired: true, paymentRequired: true, technicianApprovalRequired: true, adminApprovalRequired: false, customerOwnershipProofRequired: false, allowedStatuses: ["PENDING", "QUOTED", "PAYMENT_PENDING", "PAID", "PROCESSING", "WAITING_CUSTOMER", "COMPLETED", "REJECTED", "REFUNDED"] }, metadata: {} },
  { code: "CONFIGURATION", slug: "configuracion", name: "Configuración", description: "Configuración, transferencia de datos y puesta a punto del dispositivo.", category: "SOFTWARE", enabled: true, workflow: { initialStatus: "PENDING", quoteRequired: false, paymentRequired: false, technicianApprovalRequired: false, adminApprovalRequired: false, customerOwnershipProofRequired: false, allowedStatuses: ["PENDING", "PAID", "PROCESSING", "WAITING_CUSTOMER", "COMPLETED", "REJECTED", "REFUNDED"] }, metadata: {} }
];
