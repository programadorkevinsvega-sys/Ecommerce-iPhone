import { ADMIN_ROLES, type AdminRole } from "../domain/AdminRole";

export { ADMIN_ROLES };
export type { AdminRole };
export type Permission = `${string}:${string}`;

export const PERMISSIONS = {
  dashboardRead: "dashboard:read",
  productsRead: "products:read",
  productsWrite: "products:write",
  categoriesRead: "categories:read",
  categoriesWrite: "categories:write",
  ordersRead: "orders:read",
  ordersWrite: "orders:write",
  customersRead: "customers:read",
  customersWrite: "customers:write",
  servicesRead: "services:read",
  servicesWrite: "services:write",
  repairOrdersRead: "repair_orders:read",
  repairOrdersWrite: "repair_orders:write",
  refundsCreate: "refunds:create",
  paymentsVoid: "payments:void",
  paymentsRead: "payments:read",
  serviceTypesWrite: "service_types:write",
  adminsManage: "admins:manage",
  auditRead: "audit:read",
  inventoryRead: "inventory:read",
  inventoryWrite: "inventory:write",
  reviewsWrite: "reviews:write",
  promotionsWrite: "promotions:write",
  cmsWrite: "cms:write",
  settingsWrite: "settings:write",
  techniciansManage: "technicians:manage",
  notificationsReplay: "notifications:replay",
} as const satisfies Record<string, Permission>;

const all = Object.values(PERMISSIONS);

export const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  SUPER_ADMIN: all,
  ADMIN: all.filter((permission) => permission !== PERMISSIONS.adminsManage),
  MANAGER: [
    PERMISSIONS.dashboardRead,
    PERMISSIONS.productsRead,
    PERMISSIONS.productsWrite,
    PERMISSIONS.categoriesRead,
    PERMISSIONS.categoriesWrite,
    PERMISSIONS.ordersRead,
    PERMISSIONS.ordersWrite,
    PERMISSIONS.customersRead,
    PERMISSIONS.customersWrite,
    PERMISSIONS.servicesRead,
    PERMISSIONS.servicesWrite,
    PERMISSIONS.repairOrdersRead,
    PERMISSIONS.repairOrdersWrite,
    PERMISSIONS.paymentsRead,
    PERMISSIONS.inventoryRead,
    PERMISSIONS.inventoryWrite,
    PERMISSIONS.reviewsWrite,
    PERMISSIONS.promotionsWrite,
    PERMISSIONS.cmsWrite,
    PERMISSIONS.auditRead,
    PERMISSIONS.techniciansManage,
  ],
  SALES: [
    PERMISSIONS.dashboardRead,
    PERMISSIONS.productsRead,
    PERMISSIONS.categoriesRead,
    PERMISSIONS.ordersRead,
    PERMISSIONS.ordersWrite,
    PERMISSIONS.customersRead,
    PERMISSIONS.servicesRead,
  ],
  SUPPORT: [
    PERMISSIONS.dashboardRead,
    PERMISSIONS.ordersRead,
    PERMISSIONS.customersRead,
    PERMISSIONS.servicesRead,
    PERMISSIONS.servicesWrite,
  ],
  INVENTORY: [
    PERMISSIONS.dashboardRead,
    PERMISSIONS.productsRead,
    PERMISSIONS.productsWrite,
    PERMISSIONS.categoriesRead,
    PERMISSIONS.categoriesWrite,
    PERMISSIONS.inventoryRead,
    PERMISSIONS.inventoryWrite,
    PERMISSIONS.ordersRead,
  ],
  FINANCE: [
    PERMISSIONS.dashboardRead,
    PERMISSIONS.ordersRead,
    PERMISSIONS.paymentsRead,
    PERMISSIONS.refundsCreate,
    PERMISSIONS.paymentsVoid,
    PERMISSIONS.auditRead,
  ],
  CONTENT_EDITOR: [
    PERMISSIONS.dashboardRead,
    PERMISSIONS.productsRead,
    PERMISSIONS.productsWrite,
    PERMISSIONS.categoriesRead,
    PERMISSIONS.categoriesWrite,
    PERMISSIONS.serviceTypesWrite,
    PERMISSIONS.reviewsWrite,
    PERMISSIONS.promotionsWrite,
    PERMISSIONS.cmsWrite,
  ],
};

export interface AuthorizationPolicy {
  can(role: AdminRole, permission: Permission): boolean;
}

export class ExplicitAuthorizationPolicy implements AuthorizationPolicy {
  constructor(private readonly grants: Readonly<Record<AdminRole, readonly Permission[]>>) {}

  can(role: AdminRole, permission: Permission): boolean {
    return this.grants[role]?.includes(permission) ?? false;
  }
}

export const DEFAULT_AUTHORIZATION_POLICY = new ExplicitAuthorizationPolicy(ROLE_PERMISSIONS);

export function hasPermission(role: AdminRole, permission: string): boolean {
  return DEFAULT_AUTHORIZATION_POLICY.can(role, permission as Permission);
}

export type PermissionOverrideValue = Readonly<{ permission: Permission; granted: boolean }>;

export function resolvePermissions(role: AdminRole, overrides: ReadonlyArray<PermissionOverrideValue>): Permission[] {
  const effective = new Set<Permission>(ROLE_PERMISSIONS[role] ?? []);
  for (const override of overrides) {
    if (override.granted) effective.add(override.permission);
    else effective.delete(override.permission);
  }
  return [...effective];
}
