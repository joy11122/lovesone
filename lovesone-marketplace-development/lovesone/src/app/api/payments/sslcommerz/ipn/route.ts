import { NextRequest, NextResponse } from "next/server";
import { completeSslCommerzPayment } from "@/lib/payments/complete-sslcommerz";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const validationId = String(form.get("val_id") || "");
    const transactionId = String(form.get("tran_id") || "");
    const completion = await completeSslCommerzPayment(validationId, transactionId);
    return NextResponse.json({ received: true, reviewRequired: Boolean(completion.reviewRequired) });
  } catch (error) {
    console.error("SSLCommerz IPN rejected", error);
    return NextResponse.json({ received: false }, { status: 400 });
  }
}
