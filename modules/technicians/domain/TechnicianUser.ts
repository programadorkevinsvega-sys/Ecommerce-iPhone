import { DomainError, Entity } from "../../shared-kernel";

export type TechnicianUserProps = Readonly<{
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  active: boolean;
  failedLoginCount: number;
  lockedUntil?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}>;

export class TechnicianUser extends Entity<string> {
  private constructor(id: string, private props: TechnicianUserProps) { super(id); }

  static rehydrate(id: string, props: TechnicianUserProps) {\n    return new TechnicianUser(id, props);\n  }\n\n  static create(id: string, props: Omit<TechnicianUserProps, "createdAt" | "updatedAt"> & Partial<Pick<TechnicianUserProps, "createdAt" | "updatedAt">>) {
    const email = props.email.trim().toLowerCase();
    const firstName = props.firstName.trim();
    const lastName = props.lastName.trim();
    if (!email.includes("@") || email.length > 254) throw new DomainError("INVALID_TECHNICIAN_EMAIL");
    if (!firstName || !lastName) throw new DomainError("INVALID_TECHNICIAN_NAME");
    if (!props.passwordHash.trim()) throw new DomainError("INVALID_TECHNICIAN_PASSWORD_HASH");
    if (props.failedLoginCount < 0) throw new DomainError("INVALID_TECHNICIAN_LOGIN_STATE");
    const now = new Date().toISOString();
    return new TechnicianUser(id, {
      ...props,
      email,
      firstName,
      lastName,
      ...(props.phone?.trim() ? { phone: props.phone.trim().slice(0, 40) } : {}),
      createdAt: props.createdAt ?? now,
      updatedAt: props.updatedAt ?? now,
    });
  }

  get active() { return this.props.active; }
  recordSuccessfulLogin(now = new Date()) {
    const { lockedUntil: _lockedUntil, ...withoutLock } = this.props;
    this.props = { ...withoutLock, failedLoginCount: 0, lastLoginAt: now.toISOString(), updatedAt: now.toISOString() };
  }
  recordFailedLogin(now = new Date(), maxAttempts = 5, lockMinutes = 15) {
    const failed = this.props.failedLoginCount + 1;
    this.props = { ...this.props, failedLoginCount: failed, ...(failed >= maxAttempts ? { lockedUntil: new Date(now.getTime() + lockMinutes * 60000).toISOString() } : {}), updatedAt: now.toISOString() };
  }
  activate() { this.props = { ...this.props, active: true, updatedAt: new Date().toISOString() }; }
  deactivate() { this.props = { ...this.props, active: false, updatedAt: new Date().toISOString() }; }
  toPrimitives() { return { id: this.getId(), ...this.props }; }
}
