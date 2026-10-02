import type { D1Database } from "@cloudflare/workers-types";
import { ServiceTypeDefinition, type ServiceCategory, type ServiceTypeDefinitionProps } from "../domain/ServiceTypeDefinition";
import type { ServiceTypeRepository } from "../application/ServiceTypeRepository";

export class D1ServiceTypeRepository implements ServiceTypeRepository {
  constructor(private readonly db: D1Database) {}

  async findByCode(code: string): Promise<ServiceTypeDefinition | null> {
    const row = await this.db.prepare("SELECT * FROM service_types WHERE code=? LIMIT 1").bind(code).first<any>();
    return row ? this.map(row) : null;
  }

  async listEnabled(): Promise<ServiceTypeDefinition[]> {
    const rows = await this.db.prepare("SELECT * FROM service_types WHERE enabled=1 ORDER BY sort_order ASC, name ASC").all<any>();
    return Promise.all(rows.results.map((row) => this.map(row)));
  }

  async listAll(): Promise<ServiceTypeDefinition[]> {
    const rows = await this.db.prepare("SELECT * FROM service_types ORDER BY sort_order ASC, name ASC").all<any>();
    return Promise.all(rows.results.map((row) => this.map(row)));
  }

  async save(type: ServiceTypeDefinition): Promise<void> {
    const p = type.toPrimitives();
    const statements = [this.db.prepare(`INSERT INTO service_types (code,slug,name,description,image_url,category,workflow_json,enabled,metadata_json,sort_order,price_from_in_cents,fixed_price_in_cents,estimated_minutes,warranty_days,requires_diagnosis,requires_approval,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET slug=excluded.slug,name=excluded.name,description=excluded.description,image_url=excluded.image_url,category=excluded.category,workflow_json=excluded.workflow_json,enabled=excluded.enabled,metadata_json=excluded.metadata_json,sort_order=excluded.sort_order,price_from_in_cents=excluded.price_from_in_cents,fixed_price_in_cents=excluded.fixed_price_in_cents,estimated_minutes=excluded.estimated_minutes,warranty_days=excluded.warranty_days,requires_diagnosis=excluded.requires_diagnosis,requires_approval=excluded.requires_approval,updated_at=excluded.updated_at`).bind(p.code,p.slug,p.name,p.description,p.imageUrl ?? null,p.category,JSON.stringify(p.workflow),p.enabled?1:0,JSON.stringify(p.metadata),0,p.priceFromInCents ?? null,p.fixedPriceInCents ?? null,p.estimatedMinutes ?? null,p.warrantyDays ?? null,p.requiresDiagnosis?1:0,p.requiresApproval?1:0,p.createdAt,p.updatedAt), this.db.prepare("DELETE FROM service_type_compatibility WHERE service_type_code=?").bind(p.code), this.db.prepare("DELETE FROM service_type_requirements WHERE service_type_code=?").bind(p.code)];
    for (const item of p.compatibility ?? []) statements.push(this.db.prepare("INSERT INTO service_type_compatibility (id,service_type_code,brand,model) VALUES (?,?,?,?)").bind(crypto.randomUUID(),p.code,item.brand,item.model ?? null));
    for (const [index, item] of (p.requirements ?? []).entries()) statements.push(this.db.prepare("INSERT INTO service_type_requirements (id,service_type_code,description,required,sort_order) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),p.code,item.description,item.required?1:0,index));
    await this.db.batch(statements);
  }

  async enable(code: string): Promise<boolean> {
    const result = await this.db.prepare("UPDATE service_types SET enabled=1, updated_at=CURRENT_TIMESTAMP WHERE code=? AND enabled=0").bind(code).run();
    return result.meta.changes === 1;
  }

  async delete(code: string): Promise<boolean> {
    const result = await this.db.prepare("DELETE FROM service_types WHERE code=?").bind(code).run();
    return result.meta.changes === 1;
  }

  async disable(code: string): Promise<boolean> {
    const result = await this.db.prepare("UPDATE service_types SET enabled=0, updated_at=CURRENT_TIMESTAMP WHERE code=? AND enabled=1").bind(code).run();
    return result.meta.changes === 1;
  }

  private async map(row: any): Promise<ServiceTypeDefinition> {
    const [compatibility, requirements] = await Promise.all([
      this.db.prepare("SELECT brand,model FROM service_type_compatibility WHERE service_type_code=? ORDER BY brand,model").bind(row.code).all<any>(),
      this.db.prepare("SELECT description,required FROM service_type_requirements WHERE service_type_code=? ORDER BY sort_order,created_at").bind(row.code).all<any>(),
    ]);
    return ServiceTypeDefinition.create({
      code: row.code,
      slug: row.slug,
      name: row.name,
      description: row.description,
      ...(row.image_url ? { imageUrl: row.image_url } : {}),
      category: row.category as ServiceCategory,
      workflow: JSON.parse(row.workflow_json),
      enabled: Boolean(row.enabled),
      metadata: JSON.parse(row.metadata_json ?? "{}") as Record<string,string>,
      ...(row.price_from_in_cents !== null && row.price_from_in_cents !== undefined ? { priceFromInCents: Number(row.price_from_in_cents) } : {}),
      ...(row.fixed_price_in_cents !== null && row.fixed_price_in_cents !== undefined ? { fixedPriceInCents: Number(row.fixed_price_in_cents) } : {}),
      ...(row.estimated_minutes !== null && row.estimated_minutes !== undefined ? { estimatedMinutes: Number(row.estimated_minutes) } : {}),
      ...(row.warranty_days !== null && row.warranty_days !== undefined ? { warrantyDays: Number(row.warranty_days) } : {}),
      requiresDiagnosis: Boolean(row.requires_diagnosis),
      requiresApproval: Boolean(row.requires_approval),
      compatibility: compatibility.results.map((item) => ({ brand: String(item.brand), ...(item.model ? { model: String(item.model) } : {}) })),
      requirements: requirements.results.map((item) => ({ description: String(item.description), required: Boolean(item.required) })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as ServiceTypeDefinitionProps);
  }
}
