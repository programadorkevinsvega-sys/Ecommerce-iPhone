import type { SeoRedirectStatus } from "../domain/SeoRedirect";
import { validateSeoRedirect, validateSeoRouteOverride } from "../domain/SeoRedirect";
import type { AuditPort } from "../../admin/application/AuditPort";

export type SeoRedirectRecord = Readonly<{
  id: string;
  sourcePath: string;
  targetUrl?: string;
  statusCode: SeoRedirectStatus;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}>;

export type SeoRouteOverrideRecord = Readonly<{
  id: string;
  path: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  indexable: boolean;
  ogImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}>;

export interface SeoRepository {
  listRedirects(): Promise<readonly SeoRedirectRecord[]>;
  saveRedirect(input: {
    id: string;
    sourcePath: string;
    targetUrl?: string;
    statusCode: SeoRedirectStatus;
    active: boolean;
    adminId: string;
  }): Promise<void>;
  listRouteOverrides(): Promise<readonly SeoRouteOverrideRecord[]>;
  saveRouteOverride(input: {
    id: string;
    path: string;
    seoTitle?: string;
    seoDescription?: string;
    canonicalUrl?: string;
    indexable: boolean;
    ogImageUrl?: string;
    adminId: string;
  }): Promise<void>;
  findActiveRedirect(sourcePath: string): Promise<SeoRedirectRecord | null>;
  findRouteOverride(path: string): Promise<SeoRouteOverrideRecord | null>;
}

export class SeoManagement {
  constructor(
    private readonly repository: SeoRepository,
    private readonly audit?: AuditPort,
  ) {}

  redirects() {
    return this.repository.listRedirects();
  }

  routeOverrides() {
    return this.repository.listRouteOverrides();
  }

  async saveRedirect(input: Parameters<SeoRepository["saveRedirect"]>[0]) {
    validateSeoRedirect(input);
    await this.repository.saveRedirect(input);
    await this.audit?.audit(input.adminId, "SEO_REDIRECT_SAVED", "seo_redirect", input.sourcePath, {
      sourcePath: input.sourcePath,
      statusCode: input.statusCode,
      active: input.active,
    });
  }

  async saveRouteOverride(input: Parameters<SeoRepository["saveRouteOverride"]>[0]) {
    validateSeoRouteOverride(input);
    await this.repository.saveRouteOverride(input);
    await this.audit?.audit(input.adminId, "SEO_ROUTE_OVERRIDE_SAVED", "seo_route_override", input.path, {
      path: input.path,
      indexable: input.indexable,
    });
  }

  resolveRedirect(sourcePath: string) {
    return this.repository.findActiveRedirect(sourcePath);
  }

  resolveRouteOverride(path: string) {
    return this.repository.findRouteOverride(path);
  }
}
