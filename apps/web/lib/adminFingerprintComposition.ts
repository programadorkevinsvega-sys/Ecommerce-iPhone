import { CreateRequestFingerprint } from "../../../modules/admin/application/CreateRequestFingerprint";
import { sha256 } from "../../../modules/admin/infrastructure/AdminSecurity";

export function buildRequestFingerprint() {
  return new CreateRequestFingerprint(sha256);
}
