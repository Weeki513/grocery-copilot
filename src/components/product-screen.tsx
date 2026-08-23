"use client";

import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { price, t } from "@/lib/i18n";
import { productMetadata } from "@/lib/product-metadata";
import { useGroceryStore } from "@/store/grocery-store";
import { QuantityControl } from "./quantity-control";

export function ProductScreen() {
  const { locale, selectedProduct: product, previousScreen, navigate, addItem } = useGroceryStore(); const c = t(locale); const [quantity, setQuantity] = useState(1); const [added, setAdded] = useState(false);
  if (!product) return null;
  const metadata = productMetadata(product, locale);
  return <div className="screen product-screen"><header className="overlay-header"><button className="icon-button" aria-label={locale === "ru" ? "Назад" : "Back"} onClick={() => navigate(previousScreen === "product" ? "catalog" : previousScreen)}><ArrowLeft/></button><span className={`availability ${product.inStock ? "" : "off"}`}>{product.inStock ? <><i/> {product.lowStock ? c.lowStock : `${product.stock} ${c.stock}`}</> : c.unavailable}</span></header><div className="product-hero-placeholder" aria-hidden/><div className="product-detail-body"><span className="product-brand">{product.brand || "Market choice"}</span><h1>{product.localeData[locale].name}</h1><div className="detail-price"><strong>{price(product.price)}</strong>{product.previousPrice && product.previousPrice > product.price ? <del>{price(product.previousPrice)}</del> : null}</div><p>{product.localeData[locale].description}</p><div className="quality-note"><ShieldCheck size={16}/><span><strong>{locale === "ru" ? "Проверенные данные" : "Verified product data"}</strong><small>{product.sku} · USD</small></span></div><dl>{metadata.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></div><div className="product-sticky"><QuantityControl quantity={quantity} onDecrease={() => setQuantity(Math.max(1, quantity - 1))} onIncrease={() => setQuantity(Math.min(product.stock, quantity + 1))} disabledIncrease={quantity >= product.stock}/><button className="primary-button" disabled={!product.inStock} onClick={() => { addItem(product, quantity); setAdded(true); setTimeout(() => setAdded(false), 1400); }}>{added ? <Check size={17}/> : null}{added ? c.added : c.add}<span>{price(product.price * quantity)}</span></button></div></div>;
}
