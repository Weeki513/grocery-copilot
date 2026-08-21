import { z } from "zod";
import { getProductsByIds } from "@/server/catalog/repository";

const CheckoutSchema = z.object({
  locale: z.enum(["en", "ru"]),
  address: z.string().min(6).max(200),
  slot: z.string().min(2).max(100),
  paymentLast4: z.string().regex(/^\d{4}$/),
  comment: z.string().max(500).optional(),
  items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive().max(50) })).min(1).max(100),
});

const MAX_CHECKOUT_BODY_BYTES = 50_000;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_CHECKOUT_BODY_BYTES) return Response.json({ error: "Checkout request is too large" }, { status: 413 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid checkout details" }, { status: 400 });
  }
  if (Buffer.byteLength(JSON.stringify(body) || "", "utf8") > MAX_CHECKOUT_BODY_BYTES) return Response.json({ error: "Checkout request is too large" }, { status: 413 });
  const parsed = CheckoutSchema.safeParse(body);
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
  return Response.json({ id, createdAt, total, status: "confirmed", address: parsed.data.address, slot: parsed.data.slot });
}
