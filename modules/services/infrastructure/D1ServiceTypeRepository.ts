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
    return rows.results.map((row) => this.map(row));
  }

  async listAll(): Promise<ServiceTypeDefinition[]> {
    const rows = await this.db.prepare("SELECT * FROM service_types ORDER BY sort_order ASC, name ASC").all<any>();
    return rows.results.map((row) => this.map(row));
  }

  async save(type: ServiceTypeDefinition): Promise<void> {
    const p = type.toPrimitives();
    await this.db.prepare(`INSERT INTO service_types (code,slug,name,description,category,workflow_json,enabled,metadata_json,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET slug=excluded.slug,name=excluded.name,description=excluded.description,category=excluded.category,workflow_json=excluded.workflow_json,enabled=excluded.enabled,metadata_json=excluded.metadata_json,sort_order=excluded.sort_order,updated_at=excluded.updated_at`).bind(p.code,p.slug,p.name,p.description,p.category,JSON.stringify(p.workflow),p.enabled?1:0,JSON.stringify(p.metadata),0,p.createdAt,p.updatedAt).run();
  }

  private map(row: any): ServiceTypeDefinition {
    return ServiceTypeDefinition.create({
      code: row.code,
      slug: row.slug,
      name: row.name,
      description: row.description,
      category: row.category as ServiceCategory,
      workflow: JSON.parse(row.workflow_json),
      enabled: Boolean(row.enabled),
      metadata: JSON.parse(row.metadata_json ?? "{}") as Record<string,string>,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as ServiceTypeDefinitionProps);
  }
}
