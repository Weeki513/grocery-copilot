"use client";

import { Bot, Home, Search, ShoppingBag, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { useGroceryStore, type Screen } from "@/store/grocery-store";

const nav: Array<{ id: Screen; icon: typeof Home; label: "home" | "browse" | "assistant" | "cart" | "profile" }> = [
  { id: "home", icon: Home, label: "home" }, { id: "catalog", icon: Search, label: "browse" }, { id: "assistant", icon: Bot, label: "assistant" }, { id: "cart", icon: ShoppingBag, label: "cart" }, { id: "profile", icon: UserRound, label: "profile" },
];

export function PhoneShell({ children }: { children: ReactNode }) {
  const { locale, screen, cart, navigate } = useGroceryStore(); const c = t(locale);
  const cartCount = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  return <div className="device-frame">
    <div className="device-screen">
      <div className="status-bar"><span>5:13</span><span className="island"/><span className="signals">● ᯤ ▰</span></div>
      <main className="mobile-content">{children}</main>
      {screen !== "checkout" ? <nav className="bottom-nav" aria-label="Primary navigation">
        {nav.map((item) => { const Icon = item.icon; const active = screen === item.id; return <button key={item.label} className={active ? "active" : ""} onClick={() => navigate(item.id)}><span className="nav-icon"><Icon size={20}/>{item.label === "cart" && cartCount ? <b>{cartCount}</b> : null}</span><small>{c[item.label]}</small></button>; })}
      </nav> : null}
    </div>
  </div>;
}
