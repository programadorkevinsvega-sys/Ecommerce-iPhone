import { hashPassword, verifyPassword } from "../../admin/infrastructure/AdminSecurity";
import type { TechnicianPasswordHasher } from "../application/TechnicianPasswordHasher";
const UNKNOWN_ACCOUNT_DUMMY_HASH="pbkdf2-sha256$100000$YWRtaW4tYXV0aC1kdW1teS12MQ==$tGNg2tVRJmixbNAmRjz8qyH8LrlC7YDPLs/SFN1eU6g=";
export class D1TechnicianPasswordHasher implements TechnicianPasswordHasher{hash(password:string){return hashPassword(password);}verify(password:string,passwordHash:string){return verifyPassword(password,passwordHash);}verifyUnknownAccount(password:string){return verifyPassword(password,UNKNOWN_ACCOUNT_DUMMY_HASH).then(()=>undefined);}}
