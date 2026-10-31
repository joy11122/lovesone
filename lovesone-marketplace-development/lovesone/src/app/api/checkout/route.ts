import { NextRequest,NextResponse } from "next/server";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { auth } from "../../../../../auth";
import { connectDatabase } from "@/lib/db";
import { Product } from "@/models/Product";
import { Order } from "@/models/Order";
const schema=z.object({
 items:z.array(z.object({productId:z.string().regex(/^[a-f0-9]{24}$/i),quantity:z.number().int().min(1).max(99)})).min(1).max(40),
 shipping:z.object({name:z.string().trim().min(2).max(100),phone:z.string().trim().regex(/^(?:\+?88)?01[3-9]\d{8}$/),address:z.string().trim().min(8).max(500),city:z.string().trim().min(2).max(80)}),
 paymentMethod:z.literal("cod")
});
export async function POST(request:NextRequest){
 const session=await auth();if(!session?.user?.id)return NextResponse.json({error:"Please sign in before checkout."},{status:401});
 if(session.user.role!=="customer")return NextResponse.json({error:"Customer accounts only."},{status:403});
 const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Please check your delivery details and cart."},{status:400});
 const quantities=new Map<string,number>();for(const item of parsed.data.items)quantities.set(item.productId,(quantities.get(item.productId)||0)+item.quantity);
 if(quantities.size!==parsed.data.items.length)return NextResponse.json({error:"Remove duplicate cart lines and try again."},{status:400});
 await connectDatabase();const dbSession=await mongoose.startSession();let createdOrderId="";
 try{
  await dbSession.withTransaction(async()=>{
   const ids=[...quantities.keys()];const products=await Product.find({_id:{$in:ids},status:"active",deletedAt:null}).session(dbSession);
   if(products.length!==ids.length)throw new Error("PRODUCT_UNAVAILABLE");
   const grouped=new Map<string,{vendorId:string;items:Array<{productId:string;title:string;quantity:number;unitPrice:number;lineTotal:number}>}>();
   let total=0;
   for(const product of products){
    if(product.medicine?.isMedicine&&product.medicine?.requiresPrescription)throw new Error("PRESCRIPTION_REQUIRED");
    const quantity=quantities.get(String(product._id))||0;
    const changed=await Product.updateOne({_id:product._id,status:"active",deletedAt:null,stock:{$gte:quantity}},{$inc:{stock:-quantity}},{session:dbSession});
    if(changed.modifiedCount!==1)throw new Error("INSUFFICIENT_STOCK");
    const vendorId=String(product.vendorId);const lineTotal=product.price*quantity;total+=lineTotal;
    const group=grouped.get(vendorId)||{vendorId,items:[]};
    group.items.push({productId:String(product._id),title:product.title,quantity,unitPrice:product.price,lineTotal});grouped.set(vendorId,group);
   }
   const [order]=await Order.create([{orderNumber:"LVS-"+randomUUID().slice(0,8).toUpperCase(),customerId:session.user.id,subOrders:[...grouped.values()].map(x=>({...x,status:"pending"})),total,shipping:parsed.data.shipping,paymentMethod:"cod",paymentStatus:"pending",status:"pending"}],{session:dbSession});
   createdOrderId=String(order._id);
  });
  return NextResponse.json({message:"Order placed successfully.",orderId:createdOrderId},{status:201});
 }catch(error){
  if(error instanceof Error&&error.message==="PRODUCT_UNAVAILABLE")return NextResponse.json({error:"One or more products are no longer available. Please refresh your bag."},{status:409});
  if(error instanceof Error&&error.message==="INSUFFICIENT_STOCK")return NextResponse.json({error:"A product does not have enough stock. Please update your quantity."},{status:409});
  if(error instanceof Error&&error.message==="PRESCRIPTION_REQUIRED")return NextResponse.json({error:"Prescription-controlled products cannot be ordered online yet."},{status:422});
  console.error("Checkout failed",error);return NextResponse.json({error:"Unable to place your order right now."},{status:500});
 }finally{await dbSession.endSession();}
}