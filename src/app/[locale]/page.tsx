import { notFound } from "next/navigation";
import { GroceryApp } from "@/components/grocery-app";
import type { Locale } from "@/lib/types";
import { searchProducts } from "@/server/catalog/repository";
import { CATEGORIES } from "@/server/catalog/taxonomy";

export const dynamic = "force-dynamic";

export default async function LocalePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (locale !== "en" && locale !== "ru") notFound();
  const products = searchProducts({ limit: 30 });
  return <GroceryApp initialLocale={locale as Locale} products={products} categories={CATEGORIES}/>;
}
