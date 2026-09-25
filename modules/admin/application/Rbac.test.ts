import {describe,expect,it} from "vitest";
import {PERMISSIONS,ROLE_PERMISSIONS,hasPermission,resolvePermissions} from "./Rbac";
describe("admin RBAC",()=>{
 it("starts from the role permissions",()=>{const effective=resolvePermissions("SALES",[]);expect(effective).toContain(PERMISSIONS.ordersRead);expect(effective).not.toContain(PERMISSIONS.inventoryWrite);});
 it("applies explicit grant and deny overrides",()=>{const effective=resolvePermissions("SALES",[{permission:PERMISSIONS.inventoryRead,granted:true},{permission:PERMISSIONS.ordersRead,granted:false}]);expect(effective).toContain(PERMISSIONS.inventoryRead);expect(effective).not.toContain(PERMISSIONS.ordersRead);});
 it("keeps SUPER_ADMIN on the complete base permission set",()=>{expect(resolvePermissions("SUPER_ADMIN",[])).toEqual(ROLE_PERMISSIONS.SUPER_ADMIN);});
 it("keeps payment access granular to payment permissions",()=>{expect(resolvePermissions("FINANCE",[])).toContain(PERMISSIONS.paymentsRead);expect(resolvePermissions("SALES",[])).not.toContain(PERMISSIONS.paymentsRead);});
 it("does not grant content or review permissions to sales/support",()=>{expect(hasPermission("SALES",PERMISSIONS.cmsWrite)).toBe(false);expect(hasPermission("SALES",PERMISSIONS.reviewsWrite)).toBe(false);expect(hasPermission("SUPPORT",PERMISSIONS.cmsWrite)).toBe(false);expect(hasPermission("SUPPORT",PERMISSIONS.promotionsWrite)).toBe(false);});
 it("keeps privileged management permission limited to super admin",()=>{expect(hasPermission("SUPER_ADMIN",PERMISSIONS.adminsManage)).toBe(true);expect(hasPermission("ADMIN",PERMISSIONS.adminsManage)).toBe(false);expect(hasPermission("MANAGER",PERMISSIONS.adminsManage)).toBe(false);});
});
