"use client";

import { ArrowLeft, Bot, ShoppingBag, Trash2 } from "lucide-react";
import { price, t } from "@/lib/i18n";
import { useGroceryStore } from "@/store/grocery-store";
import { QuantityControl } from "./quantity-control";

export function CartScreen() {
  const { locale, cart, navigate, setQuantity, clearCart } = useGroceryStore(); const c = t(locale); const items = Object.values(cart);
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0); const oldTotal = items.reduce((sum, item) => sum + (item.product.previousPrice || item.product.price) * item.quantity, 0); const savings = oldTotal - subtotal; const delivery = subtotal >= 35 ? 0 : 3.99;
  return <div className="screen cart-screen"><header className="screen-header"><button className="icon-button" onClick={() => navigate("home")} aria-label={locale === "ru" ? "Назад" : "Back"}><ArrowLeft/></button><div><h1>{c.cartTitle}</h1><small>{items.length ? `${items.length} ${c.results}` : ""}</small></div>{items.length ? <button className="icon-button clear-cart-button" onClick={clearCart} aria-label={locale === "ru" ? "Очистить корзину" : "Clear cart"} title={locale === "ru" ? "Очистить корзину" : "Clear cart"}><Trash2/></button> : <span/>}</header>
    {!items.length ? <div className="empty-state cart-empty"><span><ShoppingBag size={36}/></span><h2>{c.emptyCart}</h2><p>{c.emptyCartBody}</p><button className="primary-button" onClick={() => navigate("assistant")}><Bot size={18}/>{c.tryIt}</button><button className="secondary-button" onClick={() => navigate("catalog")}>{c.browse}</button></div> : <>
      <div className="cart-list">{items.map((item) => <article className="cart-row" key={item.product.id}><div className="cart-emoji">{item.product.imageValue}</div><div className="cart-info"><strong>{item.product.localeData[locale].name}</strong><small>{item.product.brand || "Market choice"}</small><b>{price(item.product.price)}</b>{item.reason ? <span className="ai-choice"><Bot size={12}/>{locale === "ru" ? "Выбор AI" : "AI choice"}</span> : null}</div><QuantityControl quantity={item.quantity} removeAtOne onDecrease={() => setQuantity(item.product.id, item.quantity - 1)} onIncrease={() => setQuantity(item.product.id, item.quantity + 1)} disabledIncrease={item.quantity >= item.product.stock}/></article>)}</div>
      <div className="cart-summary"><div><span>{c.subtotal}</span><strong>{price(subtotal)}</strong></div><div><span>{c.deliveryFee}</span><strong className={delivery ? "" : "green"}>{delivery ? price(delivery) : c.free}</strong></div>{savings > 0.01 ? <div><span>{c.savings}</span><strong className="green">−{price(savings)}</strong></div> : null}<div className="summary-total"><span>{c.total}</span><strong>{price(subtotal + delivery)}</strong></div></div>
      <div className="cart-checkout-cta" data-testid="cart-checkout-cta"><button className="primary-button" onClick={() => navigate("checkout")}>{c.checkout}<span>{price(subtotal + delivery)}</span></button></div>
    </>}
  </div>;
}
