import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "../../../../../auth";
import { connectDatabase } from "@/lib/db";
import { enforceUserRateLimit } from "@/lib/api-rate-limit";
import { Coupon } from "@/models/Coupon";

const createSchema = z.object({
  code: z.string().trim().toUpperCase().min(3).max(40).regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/),
  description: z.string().trim().max(200).default(""),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().positive().max(10000000),
  minOrderAmount: z.number().min(0).max(100000000).default(0),
  maxDiscount: z.number().positive().max(10000000).optional(),
  startsAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable().optional(),
  usageLimit: z.number().int().positive().max(10000000).nullable().optional()
}).refine(data => data.discountType !== "percentage" || data.discountValue <= 100, { message: "Percentage discount cannot exceed 100%.", path: ["discountValue"] })
  .refine(data => !data.expiresAt || new Date(data.expiresAt) > new Date(data.startsAt), { message: "Expiry must be after the start date.", path: ["expiresAt"] });

const updateSchema = z.object({ couponId: z.string().regex(/^[a-f0-9]{24}$/i), active: z.boolean() });

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  if (session.user.role !== "admin" && session.user.role !== "super-admin") return { error: NextResponse.json({ error: "Administrator access required." }, { status: 403 }) };
  return { userId: session.user.id };
}

export async function GET() {
  try {
    const access = await requireAdmin();
    if ("error" in access) return access.error;
    await connectDatabase();
    const coupons = await Coupon.find().sort({ createdAt: -1 }).limit(100).lean();
    return NextResponse.json({ coupons });
  } catch (error) {
    console.error("Admin coupon list failed", error);
    return NextResponse.json({ error: "Unable to load coupons." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireAdmin();
    if ("error" in access) return access.error;
    const limited = await enforceUserRateLimit("admin-coupon-create", access.userId, 30, 60 * 60 * 1000);
    if (limited) return limited;
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid coupon details.", issues: parsed.error.issues }, { status: 400 });
    await connectDatabase();
    const coupon = await Coupon.create({
      ...parsed.data,
      startsAt: new Date(parsed.data.startsAt),
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      usageLimit: parsed.data.usageLimit ?? null,
      createdBy: access.userId
    });
    return NextResponse.json({ message: "Coupon created.", couponId: String(coupon._id) }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) return NextResponse.json({ error: "That coupon code already exists." }, { status: 409 });
    console.error("Admin coupon creation failed", error);
    return NextResponse.json({ error: "Unable to create coupon." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await requireAdmin();
    if ("error" in access) return access.error;
    const limited = await enforceUserRateLimit("admin-coupon-update", access.userId, 60, 60 * 60 * 1000);
    if (limited) return limited;
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid coupon update." }, { status: 400 });
    await connectDatabase();
    const coupon = await Coupon.findByIdAndUpdate(parsed.data.couponId, { $set: { active: parsed.data.active } }, { new: true }).select("_id active");
    if (!coupon) return NextResponse.json({ error: "Coupon not found." }, { status: 404 });
    return NextResponse.json({ message: parsed.data.active ? "Coupon activated." : "Coupon deactivated." });
  } catch (error) {
    console.error("Admin coupon update failed", error);
    return NextResponse.json({ error: "Unable to update coupon." }, { status: 500 });
  }
}
