import { getProduct } from "@/server/catalog/repository";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = getProduct(id);
  return product ? Response.json(product) : Response.json({ error: "Product not found" }, { status: 404 });
}
