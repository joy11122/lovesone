import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDatabase } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getTrustedClientIp } from "@/lib/client-ip";
import { User } from "@/models/User";
import { apiError } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128)
});

export async function POST(request: NextRequest) {
  try {
    await connectDatabase();

    // Prefer Vercel's proxy-provided client IP. Never trust arbitrary
    // X-Forwarded-For values in deployments outside the trusted proxy.
    const clientIp = getTrustedClientIp(request.headers);
    if (clientIp) {
      const ipLimit = await consumeRateLimit(`register:ip:${clientIp}`, 5, 15 * 60 * 1000);
      if (!ipLimit.allowed) {
        return NextResponse.json(
          { error: "Too many registration attempts. Please try again later." },
          { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } }
        );
      }
    }

    const body: unknown = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please provide valid registration details." }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase();
    const emailLimit = await consumeRateLimit(`register:email:${email}`, 5, 60 * 60 * 1000);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: "Too many registration attempts for this email. Please try again later." },
        { status: 429, headers: { "Retry-After": String(emailLimit.retryAfterSeconds) } }
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await User.create({
      name: parsed.data.name,
      email,
      passwordHash,
      role: "customer",
      status: "active"
    });
    return NextResponse.json({ message: "Account created. You can now sign in." }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    return apiError(error);
  }
}
