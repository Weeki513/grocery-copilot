"use client";

import { Plus } from "lucide-react";
import type { Locale, Product } from "@/lib/types";
import { price } from "@/lib/i18n";

export function ProductCard({ product, locale, onOpen, onAdd, compact = false }: { product: Product; locale: Locale; onOpen: () => void; onAdd: () => void; compact?: boolean }) {
  const sale = product.previousPrice && product.previousPrice > product.price;
  return <article className={`product-card ${compact ? "compact" : ""}`} onClick={onOpen}>
    {sale ? <span className="sale-pill">-{Math.round((1 - product.price / product.previousPrice!) * 100)}%</span> : null}
    <div className="product-emoji" aria-hidden>{product.imageValue}</div>
    <div className="product-copy">
      <span className="product-brand">{product.brand || "Market choice"}</span>
      <h3>{product.localeData[locale].name}</h3>
      <div className="price-row"><strong>{price(product.price)}</strong>{sale ? <del>{price(product.previousPrice!)}</del> : null}</div>
    </div>
    <button className="add-circle" disabled={!product.inStock} aria-label={`Add ${product.localeData[locale].name}`} onClick={(event) => { event.stopPropagation(); onAdd(); }}><Plus size={18} strokeWidth={2.5} /></button>
  </article>;
}
