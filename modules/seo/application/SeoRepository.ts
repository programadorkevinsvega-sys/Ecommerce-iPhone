import type { SeoRedirectStatus } from "../domain/SeoRedirect";

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
  constructor(private readonly repository: SeoRepository) {}

  redirects() {
    return this.repository.listRedirects();
  }

  routeOverrides() {
    return this.repository.listRouteOverrides();
  }

  saveRedirect(input: Parameters<SeoRepository["saveRedirect"]>[0]) {
    return this.repository.saveRedirect(input);
  }

  saveRouteOverride(input: Parameters<SeoRepository["saveRouteOverride"]>[0]) {
    return this.repository.saveRouteOverride(input);
  }

  resolveRedirect(sourcePath: string) {
    return this.repository.findActiveRedirect(sourcePath);
  }

  resolveRouteOverride(path: string) {
    return this.repository.findRouteOverride(path);
  }
}
