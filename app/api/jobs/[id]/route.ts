import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { jobDir, safeJobId } from "@/lib/storage";

export const runtime = "nodejs";

// Delete a job and all its files.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = safeJobId(params.id);
    fs.rmSync(jobDir(id), { recursive: true, force: true });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 400 });
  }
}
