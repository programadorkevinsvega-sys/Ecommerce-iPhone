import { NextResponse } from "next/server";
import { requireTechnician } from "../../../../../../lib/technicianAuth";
import {
  technicianRepairEvidenceApplication,
  technicianRepairOrderApplication,
} from "../../../../../../lib/technicianApplication";

const stages = ["RECEPTION", "DIAGNOSIS", "REPAIR", "QUALITY_CONTROL"] as const;
const imageTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { env, technician } = await requireTechnician();
    const id = (await params).id;
    await technicianRepairOrderApplication(env).getAssigned(id, technician.id);

    const stage = new URL(request.url).searchParams.get("stage");
    if (!stage || !stages.includes(stage as typeof stages[number])) {
      return NextResponse.json({ error: "Invalid evidence stage" }, { status: 400 });
    }

    const file = (await request.formData()).get("file");
    const mimeType = file instanceof File ? file.type : "";
    if (
      !(file instanceof File) ||
      !imageTypes.includes(mimeType as typeof imageTypes[number]) ||
      file.size < 1 ||
      file.size > 5 * 1024 * 1024
    ) {
      return NextResponse.json({ error: "Invalid image" }, { status: 400 });
    }

    const media = await technicianRepairEvidenceApplication(env).upload({
      repairOrderId: id,
      stage: stage as typeof stages[number],
      mimeType,
      sizeBytes: file.size,
      uploadedBy: technician.id,
      data: await file.arrayBuffer(),
    });

    return NextResponse.json(
      { media },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const status =
      code === "UNAUTHORIZED" ? 401 :
      code === "FORBIDDEN" ? 403 :
      code === "REPAIR_ORDER_NOT_FOUND" ? 404 : 400;
    return NextResponse.json(
      {
        error:
          status === 401 ? "Authentication required" :
          status === 403 ? "Forbidden" :
          status === 404 ? "Repair order not found" :
          "Unable to save evidence",
      },
      { status },
    );
  }
}
