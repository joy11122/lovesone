import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { auth } from "../../../../../../../auth";
import { connectDatabase } from "@/lib/db";
import { Order } from "@/models/Order";
const schema = z.object({ status: z.enum(["approved", "rejected"]), adminNote: z.string().trim().max(500).optional() });
export async function PATCH(request: NextRequest, context: { params: Promise<{ orderId: string }> }) { try { const session=await auth(); if(!session?.user?.id||!["admin","super-admin"].includes(session.user.role)) return NextResponse.json({error:"Forbidden"},{status:403}); const {orderId}=await context.params; if(!mongoose.isValidObjectId(orderId)) return NextResponse.json({error:"Invalid order ID"},{status:400}); const parsed=schema.safeParse(await request.json()); if(!parsed.success) return NextResponse.json({error:"Invalid review",issues:parsed.error.issues},{status:400}); await connectDatabase(); const order=await Order.findOne({_id:orderId,"returnRequest.status":"requested"}); if(!order) return NextResponse.json({error:"Return request not found"},{status:404}); order.set("returnRequest.status",parsed.data.status); order.set("returnRequest.adminNote",parsed.data.adminNote||""); order.set("returnRequest.reviewedAt",new Date()); await order.save(); return NextResponse.json({message:`Return request ${parsed.data.status}`}); } catch(error){console.error("Return review failed",error);return NextResponse.json({error:"Unable to review return request"},{status:500});} }
