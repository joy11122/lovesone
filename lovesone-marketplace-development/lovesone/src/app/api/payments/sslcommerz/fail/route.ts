import { NextResponse } from "next/server";
import { getPaymentAppUrl } from "@/lib/payments/sslcommerz";
import { reconcileSslCommerzAttempt } from "@/lib/payments/complete-sslcommerz";
import { PaymentTransaction } from "@/models/PaymentTransaction";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const transactionId = String(form.get("tran_id") || "");
    const status = await reconcileSslCommerzAttempt(transactionId);
    if (status === "review") return NextResponse.redirect(new URL("/account?payment=review", getPaymentAppUrl()), 303);
    if (status === "paid") {
      const transaction = await PaymentTransaction.findOne({ transactionId }).select("orderId").lean() as { orderId?: unknown } | null;
      if (transaction?.orderId) return NextResponse.redirect(new URL(`/order/success?orderId=${encodeURIComponent(String(transaction.orderId))}`, getPaymentAppUrl()), 303);
    }
    return NextResponse.redirect(new URL(`/account?payment=${status}`, getPaymentAppUrl()), 303);
  } catch (error) {
    console.error("SSLCommerz fail callback reconciliation failed", error);
    return NextResponse.redirect(new URL("/account?payment=pending", getPaymentAppUrl()), 303);
  }
}
