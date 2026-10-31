import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "../../../../../auth";
import { connectDatabase } from "@/lib/db";
import { VendorProfile } from "@/models/VendorProfile";

const schema = z.object({
  storeName: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^(?:\+?88)?01[3-9]\d{8}$/),
  businessAddress: z.string().trim().min(8).max(300)
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    if (session.user.role !== "customer") {
      return NextResponse.json({ error: "Only customer accounts can apply to become a seller." }, { status: 403 });
    }

    const body: unknown = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please check the store details.", issues: parsed.error.issues }, { status: 400 });
    }

    await connectDatabase();
    const existing = await VendorProfile.findOne({ userId: session.user.id }).select("_id").lean();
    if (existing) return NextResponse.json({ error: "You already have a seller application." }, { status: 409 });

    await VendorProfile.create({
      userId: session.user.id,
      ...parsed.data,
      verificationStatus: "pending"
    });
    return NextResponse.json({ message: "Application submitted. Our team will review your store details." }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "You already have a seller application." }, { status: 409 });
    }
    console.error("Vendor application failed", error);
    return NextResponse.json({ error: "Unable to submit application right now." }, { status: 500 });
  }
}
