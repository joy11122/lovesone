import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const destination = session.user.role === "admin" || session.user.role === "super-admin"
    ? "/admin"
    : session.user.role === "vendor"
      ? "/vendor/dashboard"
      : "/account";

  return NextResponse.redirect(new URL(destination, request.url));
}
