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
  imageUrl?: string;
  category: ServiceCategory;
  workflow: ServiceWorkflow;
  enabled: boolean;
  metadata: Readonly<Record<string, string>>;
  priceFromInCents?: number;
  fixedPriceInCents?: number;
  estimatedMinutes?: number;
  warrantyDays?: number;
  requiresDiagnosis?: boolean;
  requiresApproval?: boolean;
  compatibility?: readonly { brand: string; model?: string }[];
  requirements?: readonly { description: string; required: boolean }[];
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
    const imageUrl = props.imageUrl?.trim() || undefined;
    if (imageUrl && !/^\/api\/media\/service-images\/[a-z0-9-]+\.(?:jpg|png|webp)$/i.test(imageUrl)) throw new DomainError("Invalid service type image");
    if (!props.workflow) throw new DomainError("Service workflow is required");
    if (!props.workflow.allowedStatuses.includes("PENDING")) throw new DomainError("Service workflow must allow PENDING");
    for (const [key, value] of [["priceFromInCents", props.priceFromInCents], ["fixedPriceInCents", props.fixedPriceInCents], ["warrantyDays", props.warrantyDays]] as const) {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) throw new DomainError(`Invalid ${key}`);
    }
    if (props.priceFromInCents !== undefined && props.fixedPriceInCents !== undefined && props.priceFromInCents > props.fixedPriceInCents) throw new DomainError("Price from cannot exceed fixed price");
    if (props.estimatedMinutes !== undefined && (!Number.isInteger(props.estimatedMinutes) || props.estimatedMinutes <= 0)) throw new DomainError("Invalid estimated time");
    const compatibility = (props.compatibility ?? []).map((item) => ({ brand: item.brand.trim(), ...(item.model?.trim() ? { model: item.model.trim() } : {}) }));
    if (compatibility.some((item) => !item.brand || item.brand.length > 80 || (item.model && item.model.length > 120))) throw new DomainError("Invalid service compatibility");
    const requirements = (props.requirements ?? []).map((item) => ({ description: item.description.trim(), required: item.required !== false }));
    if (requirements.some((item) => !item.description || item.description.length > 240)) throw new DomainError("Invalid service requirement");
    const now = new Date().toISOString();
    return new ServiceTypeDefinition({ ...props, name: props.name.trim(), description: props.description.trim(), ...(imageUrl ? { imageUrl } : {}), compatibility, requirements, createdAt: props.createdAt ?? now, updatedAt: props.updatedAt ?? now });
  }

  toPrimitives(): ServiceTypeDefinitionProps { return this.props; }
}
