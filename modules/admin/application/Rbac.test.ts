import {describe,expect,it} from "vitest";
import {PERMISSIONS,ROLE_PERMISSIONS,hasPermission,resolvePermissions} from "./Rbac";
describe("admin RBAC",()=>{
 it("does not grant content or review permissions to sales/support",()=>{expect(hasPermission("SALES",PERMISSIONS.cmsWrite)).toBe(false);expect(hasPermission("SALES",PERMISSIONS.reviewsWrite)).toBe(false);expect(hasPermission("SUPPORT",PERMISSIONS.cmsWrite)).toBe(false);expect(hasPermission("SUPPORT",PERMISSIONS.promotionsWrite)).toBe(false);});
 it("keeps privileged management permission limited to super admin",()=>{expect(hasPermission("SUPER_ADMIN",PERMISSIONS.adminsManage)).toBe(true);expect(hasPermission("ADMIN",PERMISSIONS.adminsManage)).toBe(false);expect(hasPermission("MANAGER",PERMISSIONS.adminsManage)).toBe(false);});
 it("applies explicit permission overrides without changing the role baseline",()=>{const effective=resolvePermissions("SALES",[{permission:PERMISSIONS.cmsWrite,granted:true}]);expect(effective).toContain(PERMISSIONS.cmsWrite);expect(ROLE_PERMISSIONS.SALES).not.toContain(PERMISSIONS.cmsWrite);});
});
