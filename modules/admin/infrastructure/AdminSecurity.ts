import type { AdminRole } from "../domain/AdminRole";
import { hasPermission, PERMISSIONS, ROLE_PERMISSIONS } from "../application/Rbac";

export { hasPermission, PERMISSIONS, ROLE_PERMISSIONS };

const ITERATIONS=100_000;const KEY_LENGTH=256;const HASH_ALGORITHM="SHA-256";
const encodeBase64=(bytes:Uint8Array)=>{let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);};
const bytesFromBase64=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
export async function hashPassword(password:string):Promise<string>{if(password.length<12||password.length>128)throw new Error("Password must contain 12-128 characters");const salt=crypto.getRandomValues(new Uint8Array(16));const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:ITERATIONS,hash:HASH_ALGORITHM},key,KEY_LENGTH);return`pbkdf2-sha256$${ITERATIONS}$${encodeBase64(salt)}$${encodeBase64(new Uint8Array(bits))}`;}
function timingSafeEqual(a:Uint8Array,b:Uint8Array):boolean{if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i+=1)diff|=a[i]!^b[i]!;return diff===0;}
export async function verifyPassword(password:string,encoded:string):Promise<boolean>{const[scheme,iterationText,saltText,hashText]=encoded.split("$");if(scheme!=="pbkdf2-sha256"||!iterationText||!saltText||!hashText)return false;const iterations=Number(iterationText);if(!Number.isInteger(iterations)||iterations<100_000||iterations>500_000)return false;const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:bytesFromBase64(saltText),iterations,hash:HASH_ALGORITHM},key,KEY_LENGTH);return timingSafeEqual(new Uint8Array(bits),bytesFromBase64(hashText));}
export async function sha256(value:string):Promise<string>{const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return encodeBase64(new Uint8Array(digest));}
export type AdminPrincipal={id:string;email:string;role:AdminRole;firstName:string;lastName:string};
