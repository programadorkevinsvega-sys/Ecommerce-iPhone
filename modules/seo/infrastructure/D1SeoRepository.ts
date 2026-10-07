import type { D1Database } from "@cloudflare/workers-types";
import type { SeoRepository, SeoRedirectRecord, SeoRouteOverrideRecord } from "../application/SeoRepository";
import type { SeoRedirectStatus } from "../domain/SeoRedirect";
import { mediaKeyFromUrl } from "../../media/application/MediaReference";

type RedirectRow = {
  id: string;
  source_path: string;
  target_url: string | null;
  status_code: SeoRedirectStatus;
  active: number;
  created_at: string;
  updated_at: string;
};

type OverrideRow = {
  id: string;
  path: string;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  indexable: number;
  og_image_url: string | null;
  created_at: string;
  updated_at: string;
};

export class D1SeoRepository implements SeoRepository {
  constructor(private readonly db: D1Database) {}

  async listRedirects(): Promise<readonly SeoRedirectRecord[]> {
    const result = await this.db
      .prepare("SELECT id,source_path,target_url,status_code,active,created_at,updated_at FROM seo_redirects ORDER BY source_path ASC")
      .all<RedirectRow>();
    return result.results.map((row) => this.mapRedirect(row));
  }

  async saveRedirect(input: {
    id: string;
    sourcePath: string;
    targetUrl?: string;
    statusCode: SeoRedirectStatus;
    active: boolean;
    adminId: string;
  }): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO seo_redirects(id,source_path,target_url,status_code,active,created_by_admin_id,updated_by_admin_id) VALUES(?,?,?,?,?,?,?) ON CONFLICT(source_path) DO UPDATE SET target_url=excluded.target_url,status_code=excluded.status_code,active=excluded.active,updated_by_admin_id=excluded.updated_by_admin_id,updated_at=CURRENT_TIMESTAMP",
      )
      .bind(
        input.id,
        input.sourcePath,
        input.targetUrl ?? null,
        input.statusCode,
        input.active ? 1 : 0,
        input.adminId,
        input.adminId,
      )
      .run();
  }

  async listRouteOverrides(): Promise<readonly SeoRouteOverrideRecord[]> {
    const result = await this.db
      .prepare("SELECT id,path,seo_title,seo_description,canonical_url,indexable,og_image_url,created_at,updated_at FROM seo_route_overrides ORDER BY path ASC")
      .all<OverrideRow>();
    return result.results.map((row) => ({
      id: row.id,
      path: row.path,
      ...(row.seo_title ? { seoTitle: row.seo_title } : {}),
      ...(row.seo_description ? { seoDescription: row.seo_description } : {}),
      ...(row.canonical_url ? { canonicalUrl: row.canonical_url } : {}),
      indexable: row.indexable === 1,
      ...(row.og_image_url ? { ogImageUrl: row.og_image_url } : {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async saveRouteOverride(input: {
    id: string;
    path: string;
    seoTitle?: string;
    seoDescription?: string;
    canonicalUrl?: string;
    indexable: boolean;
    ogImageUrl?: string;
    adminId: string;
  }): Promise<void> {
    const previous = await this.db.prepare("SELECT og_image_url FROM seo_route_overrides WHERE path=? LIMIT 1").bind(input.path).first<{ og_image_url:string|null }>();
    const oldKey = previous?.og_image_url && previous.og_image_url !== (input.ogImageUrl ?? null) ? mediaKeyFromUrl(previous.og_image_url) : undefined;
    const statements = [this.db.prepare("INSERT INTO seo_route_overrides(id,path,seo_title,seo_description,canonical_url,indexable,og_image_url,created_by_admin_id,updated_by_admin_id) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET seo_title=excluded.seo_title,seo_description=excluded.seo_description,canonical_url=excluded.canonical_url,indexable=excluded.indexable,og_image_url=excluded.og_image_url,updated_by_admin_id=excluded.updated_by_admin_id,updated_at=CURRENT_TIMESTAMP").bind(input.id,input.path,input.seoTitle??null,input.seoDescription??null,input.canonicalUrl??null,input.indexable?1:0,input.ogImageUrl??null,input.adminId,input.adminId)];
    if (oldKey) statements.push(this.db.prepare("INSERT OR IGNORE INTO media_cleanup_queue (object_key) VALUES (?)").bind(oldKey));
    await this.db.batch(statements);
  }

  async findRouteOverride(path: string): Promise<SeoRouteOverrideRecord | null> {
    const row = await this.db
      .prepare("SELECT id,path,seo_title,seo_description,canonical_url,indexable,og_image_url,created_at,updated_at FROM seo_route_overrides WHERE path=? LIMIT 1")
      .bind(path)
      .first<OverrideRow>();
    if (!row) return null;
    return {
      id: row.id,
      path: row.path,
      ...(row.seo_title ? { seoTitle: row.seo_title } : {}),
      ...(row.seo_description ? { seoDescription: row.seo_description } : {}),
      ...(row.canonical_url ? { canonicalUrl: row.canonical_url } : {}),
      indexable: row.indexable === 1,
      ...(row.og_image_url ? { ogImageUrl: row.og_image_url } : {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findActiveRedirect(sourcePath: string): Promise<SeoRedirectRecord | null> {
    const row = await this.db
      .prepare("SELECT id,source_path,target_url,status_code,active,created_at,updated_at FROM seo_redirects WHERE source_path=? AND active=1 LIMIT 1")
      .bind(sourcePath)
      .first<RedirectRow>();
    return row ? this.mapRedirect(row) : null;
  }

  private mapRedirect(row: RedirectRow): SeoRedirectRecord {
    return {
      id: row.id,
      sourcePath: row.source_path,
      ...(row.target_url ? { targetUrl: row.target_url } : {}),
      statusCode: row.status_code,
      active: row.active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
