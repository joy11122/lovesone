import { requireRole } from "@/lib/authz";
import { connectDatabase } from "@/lib/db";
import { Product } from "@/models/Product";
import { VendorProfile } from "@/models/VendorProfile";
import { Order } from "@/models/Order";
import { VendorOrderActions, VendorProductEditor, VendorProductForm } from "@/components/storefront";

export const metadata = { title: "Seller dashboard" };

type VendorOrderLine = { productId: string; title: string; quantity: number; lineTotal?: number; unitPrice?: number };
type VendorSubOrder = { vendorId: unknown; status: string; items: VendorOrderLine[] };

export default async function VendorDashboardPage() {
  const user = await requireRole(["vendor"], "/vendor/dashboard");
  await connectDatabase();
  const [profileResult, products, orders] = await Promise.all([
    VendorProfile.findOne({ userId: user.id }).lean(),
    Product.find({ vendorId: user.id, deletedAt: null }).sort({ createdAt: -1 }).limit(100).lean(),
    Order.find({ "subOrders.vendorId": user.id }).sort({ createdAt: -1 }).limit(30).lean()
  ]);
  const profile = Array.isArray(profileResult) ? profileResult[0] : profileResult;
  const metrics = [
    ["Total listings", products.length],
    ["Live products", products.filter((product) => product.status === "active").length],
    ["In review", products.filter((product) => product.status === "pending-review").length],
    ["Customer orders", orders.length]
  ] as const;

  return (
    <section className="container py-12">
      <span className="eyebrow">Seller workspace</span>
      <h1 className="mt-3 text-4xl font-black">{profile?.storeName || "Your store"}</h1>
      <p className="mt-2 text-[#777487]">Manage listings, update inventory and fulfil your customer orders.</p>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-3xl border border-[#f0e9e1] bg-white p-6">
            <p className="text-sm text-[#777487]">{label}</p>
            <p className="mt-2 text-3xl font-black">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-9"><VendorProductForm /></div>

      <section className="mt-10">
        <h2 className="text-2xl font-black">Your listings</h2>
        <div className="mt-4 space-y-3">
          {products.map((product) => (
            <article key={String(product._id)} className="rounded-2xl border border-[#f0e9e1] bg-white p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h3 className="font-black">{product.title}</h3>
                  <p className="mt-1 text-sm text-[#777487]">৳{product.price.toLocaleString("en-BD")} · {product.stock} in stock</p>
                </div>
                <span className="h-fit rounded-full bg-[#fff0e3] px-3 py-1 text-xs font-bold capitalize">{product.status.replace("-", " ")}</span>
              </div>
              <VendorProductEditor
                productId={String(product._id)}
                price={product.price}
                stock={product.stock}
                status={product.status}
              />
            </article>
          ))}
          {!products.length && <p className="rounded-2xl border border-dashed border-[#e8ddd2] p-8 text-sm text-[#777487]">Your store is ready for its first listing.</p>}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-2xl font-black">Customer orders</h2><p className="mt-1 text-sm text-[#777487]">Only the items and delivery details assigned to your store are shown.</p></div>
          <span className="rounded-full bg-[#fff0e3] px-3 py-1 text-xs font-bold">{orders.length} recent orders</span>
        </div>
        <div className="mt-4 space-y-3">
          {orders.map((order) => {
            const subOrder = (order.subOrders as VendorSubOrder[]).find((item) => String(item.vendorId) === user.id);
            if (!subOrder) return null;
            const subTotal = subOrder.items.reduce((sum, item) => sum + (item.lineTotal ?? Number(item.unitPrice || 0) * item.quantity), 0);
            return (
              <article key={String(order._id)} className="rounded-2xl border border-[#f0e9e1] bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h3 className="font-black">{order.orderNumber}</h3><p className="mt-1 text-xs text-[#777487]">{order.createdAt.toLocaleString("en-BD")}</p></div>
                  <span className="rounded-full bg-[#fff0e3] px-3 py-1 text-xs font-bold capitalize">{subOrder.status}</span>
                </div>
                <div className="mt-4 rounded-2xl bg-[#fffaf5] p-4">
                  <p className="font-bold">{order.shipping.name} · {order.shipping.phone}</p>
                  <p className="mt-1 text-sm text-[#777487]">{order.shipping.address}, {order.shipping.city}</p>
                </div>
                <div className="mt-4 space-y-2">
                  {subOrder.items.map((item) => (
                    <div key={item.productId} className="flex flex-wrap justify-between gap-2 text-sm">
                      <span>{item.title} × {item.quantity}</span>
                      <strong>৳{(item.lineTotal ?? Number(item.unitPrice || 0) * item.quantity).toLocaleString("en-BD")}</strong>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-[#f0e9e1] pt-3 text-sm font-black"><span>Your order total</span><span>৳{subTotal.toLocaleString("en-BD")}</span></div>
                </div>
                <VendorOrderActions orderId={String(order._id)} status={subOrder.status} />
              </article>
            );
          })}
          {!orders.length && <p className="rounded-2xl border border-dashed border-[#e8ddd2] p-8 text-sm text-[#777487]">Customer orders will appear here after checkout.</p>}
        </div>
      </section>
    </section>
  );
}
