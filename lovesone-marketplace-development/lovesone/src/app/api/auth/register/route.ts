import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { apiError } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128)
});

export async function POST(request: NextRequest) {
  try {
    const input = schema.parse(await request.json());
    await connectDatabase();
    const email = input.email.toLowerCase();
    const exists = await User.exists({ email });
    if (exists) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    const passwordHash = await bcrypt.hash(input.password, 12);
    await User.create({ name: input.name, email, passwordHash, role: "customer", status: "active" });
    return NextResponse.json({ message: "Account created. You can now sign in." }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    return apiError(error);
  }
}
