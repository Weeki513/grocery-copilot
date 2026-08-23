"use client";

import {
  Apple,
  ArrowRight,
  Beef,
  Cookie,
  CupSoda,
  Milk,
  PackageOpen,
  Search,
  type LucideIcon,
} from "lucide-react";
import type { Category, Locale, Product } from "@/lib/types";
import { t } from "@/lib/i18n";
import { useGroceryStore } from "@/store/grocery-store";
import { ProductCard } from "./product-card";

const categoryPresentation: Array<{ icon: LucideIcon; label: Record<Locale, string> }> = [
  { icon: PackageOpen, label: { en: "Pantry", ru: "Бакалея" } },
  { icon: CupSoda, label: { en: "Drinks", ru: "Напитки" } },
  { icon: Milk, label: { en: "Dairy", ru: "Молочное" } },
  { icon: Cookie, label: { en: "Snacks", ru: "Снеки" } },
  { icon: Apple, label: { en: "Produce", ru: "Овощи" } },
  { icon: Beef, label: { en: "Protein", ru: "Белок" } },
];

export function HomeScreen({ products }: { products: Product[]; categories: Category[] }) {
  const { locale, setLocale, navigate, openCatalogWithFocus, addItem, selectProduct } = useGroceryStore();
  const c = t(locale);

  return <div className="screen home-screen">
    <div className="mobile-brand">Grocery Copilot</div>
    <header className="home-header">
      <div className="address-button"><span><small>{c.delivery}</small><strong>{c.address}</strong></span></div>
      <button className="locale-toggle" onClick={() => setLocale(locale === "en" ? "ru" : "en")}>{locale === "en" ? "RU" : "EN"}</button>
    </header>
    <div className="greeting"><h1>{c.headline}</h1></div>
    <button className="search-button" onClick={openCatalogWithFocus}><Search size={16} /><span>{c.search}</span></button>
    <button className="ai-hero" onClick={() => navigate("assistant")}><h2>{c.aiTitle}</h2><p>{c.aiBody}</p><span className="hero-action">{c.tryIt}<ArrowRight size={14} /></span></button>
    <section>
      <div className="section-heading"><h2>{c.categories}</h2><button aria-label={c.seeAll} onClick={() => navigate("catalog")}><ArrowRight size={14} /></button></div>
      <div className="category-strip">{categoryPresentation.map(({ icon: Icon, label }) => <button key={label.en} onClick={() => navigate("catalog")}><Icon size={17} strokeWidth={1.5} /><small>{label[locale]}</small></button>)}</div>
    </section>
    <section>
      <div className="section-heading"><h2>{c.popular}</h2><button aria-label={c.seeAll} onClick={() => navigate("catalog")}><ArrowRight size={14} /></button></div>
      <div className="product-strip">{products.slice(0, 3).map((product) => <ProductCard key={product.id} product={product} locale={locale as Locale} compact onOpen={() => selectProduct(product)} onAdd={() => addItem(product)} />)}</div>
    </section>
  </div>;
}
