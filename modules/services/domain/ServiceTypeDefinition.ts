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
