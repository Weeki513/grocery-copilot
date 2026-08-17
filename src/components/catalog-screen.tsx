"use client";

import { ArrowLeft, BadgeCheck, Database, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Category, Product } from "@/lib/types";
import { t } from "@/lib/i18n";
import { useGroceryStore } from "@/store/grocery-store";
import { ProductCard } from "./product-card";

type CatalogResponse = {
  products: Product[];
  total: number;
  catalogTotal: number;
  inStockTotal: number;
};

export function CatalogScreen({ initialProducts, categories }: { initialProducts: Product[]; categories: Category[] }) {
  const { locale, navigate, addItem, selectProduct, catalogAutofocus, consumeCatalogAutofocus } = useGroceryStore();
  const c = t(locale);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [products, setProducts] = useState(initialProducts);
  const [total, setTotal] = useState(10000);
  const [catalogTotal, setCatalogTotal] = useState(10000);
  const [inStockTotal, setInStockTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/catalog?q=${encodeURIComponent(query)}&category=${category}&limit=40&offset=0`, { signal: controller.signal });
        const data = await response.json() as CatalogResponse;
        setProducts(data.products); setTotal(data.total); setCatalogTotal(data.catalogTotal); setInStockTotal(data.inStockTotal);
      } catch (error) {
        if ((error as Error).name !== "AbortError") { setProducts([]); setTotal(0); }
      } finally { setLoading(false); }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, category]);

  useEffect(() => {
    if (!catalogAutofocus) return;
    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true });
      consumeCatalogAutofocus();
    });
    return () => cancelAnimationFrame(frame);
  }, [catalogAutofocus, consumeCatalogAutofocus]);

  async function loadMore() {
    if (loadingMore || products.length >= total) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/catalog?q=${encodeURIComponent(query)}&category=${category}&limit=40&offset=${products.length}`);
      const data = await response.json() as CatalogResponse;
      setProducts((current) => {
        const ids = new Set(current.map((product) => product.id));
        return [...current, ...data.products.filter((product) => !ids.has(product.id))];
      });
      setTotal(data.total); setCatalogTotal(data.catalogTotal); setInStockTotal(data.inStockTotal);
    } finally { setLoadingMore(false); }
  }

  return <div className="screen catalog-screen">
    <header className="screen-header"><button className="icon-button" onClick={() => navigate("home")} aria-label={locale === "ru" ? "Назад" : "Back"}><ArrowLeft/></button><div><h1>{c.catalog}</h1><small>{catalogTotal.toLocaleString("en-US")} SKU</small></div><button className="icon-button" aria-label={c.filters}><SlidersHorizontal/></button></header>
    <label className="catalog-search"><Search size={18}/><input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={c.search}/>{query ? <button onClick={() => setQuery("")} aria-label={c.clearSearch}><X size={16}/></button> : null}</label>
    <section className="catalog-proof"><span><Database size={18}/></span><div><strong><BadgeCheck size={13}/>{catalogTotal.toLocaleString("en-US")} {locale === "ru" ? "SKU подтверждено базой" : "SKU verified by database"}</strong><small>{categories.length} {locale === "ru" ? "категорий" : "categories"} · {inStockTotal.toLocaleString("en-US")} {locale === "ru" ? "в наличии" : "in stock"}</small><i><b style={{ width: `${Math.min(100, catalogTotal ? products.length / catalogTotal * 100 : 0)}%` }}/></i></div></section>
    <div className="filter-chips"><button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>{c.seeAll}</button>{categories.map((item) => <button key={item.id} className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)}>{item.emoji} {item.name[locale]}</button>)}</div>
    <div className="catalog-meta"><span>{locale === "ru" ? "Показано" : "Showing"} {products.length.toLocaleString("en-US")} {locale === "ru" ? "из" : "of"} {total.toLocaleString("en-US")}</span><span className="stock-dot">● {c.inStock}</span></div>
    {loading ? <div className="product-grid">{Array.from({ length: 8 }).map((_, index) => <div className="product-skeleton" key={index}/>)}</div> : products.length ? <><div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} locale={locale} onOpen={() => selectProduct(product)} onAdd={() => addItem(product)}/>)}</div>{products.length < total ? <button className="catalog-load-more" disabled={loadingMore} onClick={loadMore}>{loadingMore ? (locale === "ru" ? "Загружаю…" : "Loading…") : (locale === "ru" ? `Показать ещё · осталось ${(total - products.length).toLocaleString("en-US")}` : `Load more · ${(total - products.length).toLocaleString("en-US")} remaining`)}</button> : null}</> : <div className="empty-state"><span>🧺</span><h2>{c.noResults}</h2><button className="secondary-button" onClick={() => { setQuery(""); setCategory("all"); }}>{c.clearSearch}</button></div>}
  </div>;
}
