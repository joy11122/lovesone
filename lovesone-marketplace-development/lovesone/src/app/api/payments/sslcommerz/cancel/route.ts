import { NextResponse } from "next/server";
import { getPaymentAppUrl } from "@/lib/payments/sslcommerz";

// Do not release a payment attempt based on an unsigned browser redirect.
// A new attempt becomes available after the provider session's short expiry.
export async function POST() {
  return NextResponse.redirect(new URL("/checkout?payment=cancelled", getPaymentAppUrl()), 303);
}
