import { NextResponse } from "next/server";
import { auth } from "../../../../../../../auth";
import { connectDatabase } from "@/lib/db";
import { enforceUserRateLimit } from "@/lib/api-rate-limit";
import { PaymentTransaction } from "@/models/PaymentTransaction";
import { reconcileSslCommerzAttempt } from "@/lib/payments/complete-sslcommerz";

export async function POST(_request: Request, context: { params: Promise<{ transactionId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!["admin", "super-admin"].includes(session.user.role)) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

    const { transactionId } = await context.params;
    if (!/^LVS-[A-Z0-9]{24}$/.test(transactionId)) return NextResponse.json({ error: "Invalid payment transaction." }, { status: 400 });

    await connectDatabase();
    const limited = await enforceUserRateLimit("admin-payment-reconcile", session.user.id, 30, 60 * 60 * 1000);
    if (limited) return limited;

    const transaction = await PaymentTransaction.findOne({ provider: "sslcommerz", transactionId })
      .select("status")
      .lean() as unknown as { status: string } | null;
    if (!transaction) return NextResponse.json({ error: "Payment transaction not found." }, { status: 404 });
    if (!["pending", "initiated"].includes(transaction.status)) {
      return NextResponse.json({ message: "This payment is not awaiting reconciliation.", status: transaction.status }, { status: 409 });
    }

    const status = await reconcileSslCommerzAttempt(transactionId);
    return NextResponse.json({ message: "Provider reconciliation completed.", status });
  } catch (error) {
    console.error("Admin payment reconciliation failed", error);
    return NextResponse.json({ error: "Unable to reconcile this payment with SSLCommerz right now." }, { status: 502 });
  }
}
