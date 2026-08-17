import { z } from "zod";
import { getDb } from "@/server/db";
import { createCatalogSchema } from "@/server/catalog/schema";
import { getProductsByIds } from "@/server/catalog/repository";

const CheckoutSchema = z.object({
  locale: z.enum(["en", "ru"]),
  address: z.string().min(6).max(200),
  slot: z.string().min(2).max(100),
  paymentLast4: z.string().regex(/^\d{4}$/),
  comment: z.string().max(500).optional(),
  items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive().max(50) })).min(1).max(100),
});

export async function POST(request: Request) {
  const parsed = CheckoutSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid checkout details" }, { status: 400 });
  const products = getProductsByIds(parsed.data.items.map((item) => item.productId));
  const map = new Map(products.map((product) => [product.id, product]));
  if (products.length !== new Set(parsed.data.items.map((item) => item.productId)).size) return Response.json({ error: "One or more products no longer exist" }, { status: 409 });
  for (const item of parsed.data.items) {
    const product = map.get(item.productId)!;
    if (!product.inStock || product.stock < item.quantity) return Response.json({ error: `${product.sku} is no longer available in that quantity` }, { status: 409 });
  }
  const subtotal = Math.round(parsed.data.items.reduce((sum, item) => sum + map.get(item.productId)!.price * item.quantity, 0) * 100) / 100;
  const deliveryFee = subtotal >= 35 ? 0 : 3.99;
  const total = Math.round((subtotal + deliveryFee) * 100) / 100;
  const id = `GC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
  const createdAt = new Date().toISOString();
  const db = getDb(); createCatalogSchema(db);
  db.prepare(`INSERT INTO orders (id, created_at, locale, address, slot, payment_last4, comment, subtotal, delivery_fee, total, items_json, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`).run(id, createdAt, parsed.data.locale, parsed.data.address, parsed.data.slot, parsed.data.paymentLast4, parsed.data.comment || null, subtotal, deliveryFee, total, JSON.stringify(parsed.data.items));
  return Response.json({ id, createdAt, total, status: "confirmed", address: parsed.data.address, slot: parsed.data.slot });
}
