import { NextResponse } from "next/server";
import { getPaymentAppUrl } from "@/lib/payments/sslcommerz";

// The provider's failure redirect is not proof of a final payment state.
// Keep the attempt locked until its short gateway session expires; IPN/success
// validation remains the only source of truth for a successful payment.
export async function POST() {
  return NextResponse.redirect(new URL("/checkout?payment=failed", getPaymentAppUrl()), 303);
}
