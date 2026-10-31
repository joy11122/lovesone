import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "../../../../../../../auth";
import { connectDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { VendorProfile } from "@/models/VendorProfile";

export async function POST(_request: NextRequest, context: { params: Promise<{ vendorId: string }> }) {
  const sessionUser = await auth();
  if (!sessionUser?.user?.id || !["admin", "super-admin"].includes(sessionUser.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { vendorId } = await context.params;
  if (!mongoose.isValidObjectId(vendorId)) return NextResponse.json({ error: "Invalid vendor ID" }, { status: 400 });
  try {
    await connectDatabase();
    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        const profile = await VendorProfile.findOne({ _id: vendorId, verificationStatus: { $in: ["pending", "under-review"] } }).session(dbSession);
        if (!profile) throw new Error("APPLICATION_NOT_FOUND");
        const account = await User.findOne({ _id: profile.userId, status: "active", role: "customer" }).session(dbSession);
        if (!account) throw new Error("ACCOUNT_NOT_ELIGIBLE");
        profile.verificationStatus = "verified";
        await profile.save({ session: dbSession });
        account.role = "vendor";
        await account.save({ session: dbSession });
      });
    } finally { await dbSession.endSession(); }
    return NextResponse.json({ message: "Vendor approved", vendorId });
  } catch (error) {
    if (error instanceof Error && error.message === "APPLICATION_NOT_FOUND") return NextResponse.json({ error: "Pending vendor application not found" }, { status: 404 });
    if (error instanceof Error && error.message === "ACCOUNT_NOT_ELIGIBLE") return NextResponse.json({ error: "Applicant account is not active or eligible for vendor access" }, { status: 409 });
    console.error("Vendor approval failed", error);
    return NextResponse.json({ error: "Unable to approve vendor right now" }, { status: 500 });
  }
}
