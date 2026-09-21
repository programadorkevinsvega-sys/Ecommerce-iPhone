import { TechnicianUser } from "../domain/TechnicianUser";
import type { TechnicianPasswordHasher } from "./TechnicianPasswordHasher";
import type { TechnicianRepository } from "./TechnicianRepository";
import type { TechnicianSessionRepository } from "./TechnicianSessionRepository";

const required = (value: unknown, code = "INVALID_TECHNICIAN_DATA") => {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(code);
  return result;
};

export class TechnicianManagement {
  constructor(
    private readonly users: TechnicianRepository,
    private readonly passwords: TechnicianPasswordHasher,
    private readonly sessions: TechnicianSessionRepository,
  ) {}

  async list() {
    return (await this.users.list()).map((user) => {
      const p = user.toPrimitives();
      return { id: p.id, email: p.email, firstName: p.firstName, lastName: p.lastName, phone: p.phone ?? null, active: p.active, lastLoginAt: p.lastLoginAt ?? null, createdAt: p.createdAt };
    });
  }

  async create(input: Record<string, unknown>, actorId: string) {
    const email = required(input.email).toLowerCase();
    if (await this.users.findByEmail(email)) throw new Error("TECHNICIAN_ALREADY_EXISTS");
    const user = TechnicianUser.create(crypto.randomUUID(), {
      email,
      passwordHash: await this.passwords.hash(required(input.password)),
      firstName: required(input.firstName),
      lastName: required(input.lastName),
      ...(typeof input.phone === "string" && input.phone.trim() ? { phone: input.phone.trim() } : {}),
      active: true,
      failedLoginCount: 0,
    });
    await this.users.save(user);
    await this.users.audit(actorId, "TECHNICIAN_CREATED", "technician_user", user.getId(), { email });
    return user.getId();
  }

  async update(input: Record<string, unknown>, actorId: string) {
    const id = required(input.id, "ID_REQUIRED");
    const current = await this.users.findById(id);
    if (!current) throw new Error("TECHNICIAN_NOT_FOUND");
    const old = current.toPrimitives();
    const email = input.email === undefined ? old.email : required(input.email).toLowerCase();
    if (email !== old.email) {
      const duplicate = await this.users.findByEmail(email);
      if (duplicate && duplicate.getId() !== id) throw new Error("TECHNICIAN_ALREADY_EXISTS");
    }
    const next = TechnicianUser.create(id, {
      ...old,
      email,
      firstName: input.firstName === undefined ? old.firstName : required(input.firstName),
      lastName: input.lastName === undefined ? old.lastName : required(input.lastName),
      ...(input.phone === undefined ? {} : typeof input.phone === "string" && input.phone.trim() ? { phone: input.phone.trim() } : {}),
      passwordHash: typeof input.password === "string" && input.password ? await this.passwords.hash(input.password) : old.passwordHash,
      active: input.active === undefined ? old.active : input.active === true,
    });
    await this.users.save(next);
    if (next.toPrimitives().passwordHash !== old.passwordHash || next.toPrimitives().active !== old.active) await this.sessions.revokeAll(id);
    await this.users.audit(actorId, "TECHNICIAN_UPDATED", "technician_user", id, { fields: Object.keys(input).filter((key) => key !== "password") });
  }

  async updateProfile(id: string, input: Record<string, unknown>) {
    const current = await this.users.findById(id);
    if (!current) throw new Error("TECHNICIAN_NOT_FOUND");
    const old = current.toPrimitives();
    const next = TechnicianUser.create(id, {
      ...old,
      firstName: required(input.firstName, "INVALID_PROFILE"),
      lastName: required(input.lastName, "INVALID_PROFILE"),
      ...(typeof input.phone === "string" && input.phone.trim() ? { phone: input.phone.trim() } : {}),
      passwordHash: old.passwordHash,
    });
    await this.users.save(next);
    await this.users.audit(id, "PROFILE_UPDATED", "technician_user", id, {});
    return { id, email: next.toPrimitives().email, firstName: next.toPrimitives().firstName, lastName: next.toPrimitives().lastName, phone: next.toPrimitives().phone ?? null };
  }
}
