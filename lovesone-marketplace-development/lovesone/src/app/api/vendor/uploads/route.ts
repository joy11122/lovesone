import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { auth } from "../../../../../auth";
import { connectDatabase } from "@/lib/db";
import { VendorProfile } from "@/models/VendorProfile";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    if (session.user.role !== "vendor") return NextResponse.json({ error: "Verified seller access is required." }, { status: 403 });

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret || !/^[a-zA-Z0-9_-]+$/.test(cloudName)) {
      return NextResponse.json({ error: "Product image storage is not configured yet." }, { status: 503 });
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_FILE_SIZE + 64 * 1024) {
      return NextResponse.json({ error: "Image must be 5 MB or smaller." }, { status: 413 });
    }

    await connectDatabase();
    const profile = await VendorProfile.findOne({
      userId: session.user.id,
      verificationStatus: "verified"
    }).select("_id").lean();
    if (!profile) return NextResponse.json({ error: "Your seller profile is not verified." }, { status: 403 });

    const incoming = await request.formData().catch(() => null);
    const file = incoming?.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Use a JPEG, PNG, WebP or AVIF image." }, { status: 415 });
    }
    if (file.size < 1 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Image must be between 1 byte and 5 MB." }, { status: 413 });
    }

    const folder = `lovesone/vendors/${session.user.id}/products`;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash("sha1")
      .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
      .digest("hex");

    const payload = new FormData();
    payload.set("file", file);
    payload.set("api_key", apiKey);
    payload.set("timestamp", String(timestamp));
    payload.set("folder", folder);
    payload.set("signature", signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: payload, signal: AbortSignal.timeout(30_000) }
    );
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok || typeof result !== "object" || result === null ||
        !("secure_url" in result) || typeof result.secure_url !== "string" ||
        !("public_id" in result) || typeof result.public_id !== "string") {
      console.error("Cloudinary upload failed", { status: response.status });
      return NextResponse.json({ error: "Image upload failed. Please try another image." }, { status: 502 });
    }

    const uploadedUrl = new URL(result.secure_url);
    if (uploadedUrl.protocol !== "https:" || uploadedUrl.hostname !== "res.cloudinary.com" ||
        !uploadedUrl.pathname.startsWith(`/${cloudName}/image/upload/`) ||
        !result.public_id.startsWith(`${folder}/`)) {
      console.error("Cloudinary returned an unexpected upload location");
      return NextResponse.json({ error: "Image storage returned an invalid response." }, { status: 502 });
    }

    return NextResponse.json({
      imageUrl: result.secure_url,
      publicId: result.public_id
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "Image upload timed out. Please try again." }, { status: 504 });
    }
    console.error("Vendor image upload failed", error);
    return NextResponse.json({ error: "Unable to upload this image right now." }, { status: 500 });
  }
}
