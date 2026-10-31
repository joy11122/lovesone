import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: "Invalid request", issues: error.issues }, { status: 400 });
  console.error("API request failed", error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
