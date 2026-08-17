"use client";

import { ArrowRight, Bot, ChevronDown, Clock3, MapPin, Search, Sparkles } from "lucide-react";
import type { Category, Locale, Product } from "@/lib/types";
import { t } from "@/lib/i18n";
import { useGroceryStore } from "@/store/grocery-store";
import { ProductCard } from "./product-card";

export function HomeScreen({ products, categories }: { products: Product[]; categories: Category[] }) {
  const { locale, setLocale, navigate, openCatalogWithFocus, addItem, selectProduct } = useGroceryStore(); const c = t(locale);
  return <div className="screen home-screen">
    <header className="home-header">
      <button className="address-button"><span className="address-icon"><MapPin size={17}/></span><span><small>{c.delivery}</small><strong>{c.address} <ChevronDown size={14}/></strong></span></button>
      <button className="locale-toggle" onClick={() => setLocale(locale === "en" ? "ru" : "en")}>{locale === "en" ? "RU" : "EN"}</button>
    </header>
    <div className="greeting"><span>{c.hello}</span><h1>{c.headline}</h1></div>
    <button className="search-button" onClick={openCatalogWithFocus}><Search size={18}/><span>{c.search}</span></button>
    <button className="ai-hero" onClick={() => navigate("assistant")}>
      <div className="hero-orb"><Bot size={26}/></div><span className="hero-kicker"><Sparkles size={13}/> Grocery Copilot</span><h2>{c.aiTitle}</h2><p>{c.aiBody}</p>
      <span className="hero-action">{c.tryIt}<ArrowRight size={16}/></span><span className="hero-time"><Clock3 size={13}/> 8–12 sec</span>
    </button>
    <section><div className="section-heading"><h2>{c.categories}</h2><button onClick={() => navigate("catalog")}>{c.seeAll}</button></div><div className="category-strip">{categories.slice(0, 7).map((category) => <button key={category.id} onClick={() => navigate("catalog")}><span>{category.emoji}</span><small>{category.name[locale]}</small></button>)}</div></section>
    <section><div className="section-heading"><h2>{c.popular}</h2><button onClick={() => navigate("catalog")}>{c.seeAll}</button></div><div className="product-strip">{products.slice(0, 7).map((product) => <ProductCard key={product.id} product={product} locale={locale as Locale} compact onOpen={() => selectProduct(product)} onAdd={() => addItem(product)}/>)}</div></section>
  </div>;
}
