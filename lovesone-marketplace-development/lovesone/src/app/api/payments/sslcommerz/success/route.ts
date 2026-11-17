import { NextRequest, NextResponse } from "next/server";
import { completeSslCommerzPayment } from "@/lib/payments/complete-sslcommerz";
import { getPaymentAppUrl } from "@/lib/payments/sslcommerz";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const validationId = String(form.get("val_id") || "");
    const transactionId = String(form.get("tran_id") || "");
    const { orderId } = await completeSslCommerzPayment(validationId, transactionId);
    return NextResponse.redirect(new URL(`/order/success?orderId=${encodeURIComponent(orderId)}`, getPaymentAppUrl()), 303);
  } catch (error) {
    console.error("SSLCommerz success callback rejected", error);
    return NextResponse.redirect(new URL("/checkout?payment=verification-failed", getPaymentAppUrl()), 303);
  }
}
