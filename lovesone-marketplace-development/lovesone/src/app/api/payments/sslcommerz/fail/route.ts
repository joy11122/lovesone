import { NextRequest, NextResponse } from "next/server";
import { connectDatabase } from "@/lib/db";
import { getPaymentAppUrl } from "@/lib/payments/sslcommerz";
import { PaymentTransaction } from "@/models/PaymentTransaction";
import { Order } from "@/models/Order";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const transactionId = String(form.get("tran_id") || "");
    await connectDatabase();
    const transaction = await PaymentTransaction.findOneAndUpdate(
      { provider: "sslcommerz", transactionId, status: { $in: ["pending", "initiated"] } },
      { $set: { status: "failed" } },
      { new: true }
    ).select("orderId");
    if (transaction) {
      await Order.updateOne({ _id: transaction.orderId, paymentAttemptId: transactionId, paymentStatus: "pending" }, { $set: { paymentAttemptId: null } });
    }
    const target = new URL("/checkout?payment=failed", getPaymentAppUrl());
    return NextResponse.redirect(target, 303);
  } catch (error) {
    console.error("SSLCommerz fail callback failed", error);
    return NextResponse.redirect(new URL("/checkout?payment=failed", getPaymentAppUrl()), 303);
  }
}
