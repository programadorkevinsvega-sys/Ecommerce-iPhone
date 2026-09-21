import { NextResponse } from "next/server";
import { technicianAuthApplicationForRequest } from "../../../../../lib/technicianApplication";
import { setTechnicianSession, technicianRequestFingerprint } from "../../../../../lib/technicianAuth";
import { validateEmail } from "../../../../../lib/inputValidation";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const email = validateEmail(String(body.email ?? ""));
    const password = typeof body.password === "string" ? body.password : "";
    const fingerprint = await technicianRequestFingerprint();
    const result = await technicianAuthApplicationForRequest().authenticate(
      email,
      password,
      fingerprint.ipHash,
      fingerprint.userAgentHash,
    );
    await setTechnicianSession(result.token, result.expiresAt);
    return NextResponse.json(
      { technician: result.principal },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status =
      code === "ACCOUNT_DISABLED" ? 403 :
      code === "ACCOUNT_LOCKED" ? 423 :
      code === "INVALID_CREDENTIALS" ? 401 : 400;
    return NextResponse.json(
      {
        error:
          status === 403 ? "Cuenta desactivada" :
          status === 423 ? "Cuenta temporalmente bloqueada" :
          status === 401 ? "Credenciales inválidas" :
          "Datos de acceso inválidos",
      },
      { status, headers: { "cache-control": "no-store" } },
    );
  }
}
