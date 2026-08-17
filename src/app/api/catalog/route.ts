import { CATEGORIES } from "@/server/catalog/taxonomy";
import { catalogStats, searchProductPage } from "@/server/catalog/repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = searchProductPage({
    query: url.searchParams.get("q") || undefined,
    category: url.searchParams.get("category") || undefined,
    limit: Number(url.searchParams.get("limit") || 30),
    offset: Number(url.searchParams.get("offset") || 0),
  });
  const stats = catalogStats();
  return Response.json({
    products: page.products, categories: CATEGORIES, total: page.total, offset: page.offset, returned: page.products.length,
    catalogTotal: stats.total, inStockTotal: stats.inStock,
  }, { headers: { "X-Catalog-Total": String(stats.total), "X-Catalog-Returned": String(page.products.length) } });
}
