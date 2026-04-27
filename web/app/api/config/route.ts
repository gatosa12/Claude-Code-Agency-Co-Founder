import { NextResponse } from "next/server";
import { aiAvailable } from "@/lib/ai";
import { imageGenAvailable } from "@/lib/images";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    aiAvailable: aiAvailable(),
    imageGenAvailable: imageGenAvailable(),
  });
}
