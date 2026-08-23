"use client";

import type { Category, Locale, Product } from "@/lib/types";
import { useEffect } from "react";
import { useGroceryStore } from "@/store/grocery-store";
import { AssistantScreen } from "./assistant-screen";
import { CartScreen } from "./cart-screen";
import { CatalogScreen } from "./catalog-screen";
import { CheckoutScreen } from "./checkout-screen";
import { HomeScreen } from "./home-screen";
import { Inspector } from "./inspector";
import { PhoneShell } from "./phone-shell";
import { ProductScreen } from "./product-screen";
import { ProfileScreen } from "./profile-screen";

export function GroceryApp({ initialLocale, products, categories }: { initialLocale: Locale; products: Product[]; categories: Category[] }) {
  const { locale, screen, assistantView } = useGroceryStore();
  useEffect(() => { useGroceryStore.setState({ locale: initialLocale }); }, [initialLocale]);
  useEffect(() => { const next = `/${locale}`; if (window.location.pathname !== next) window.history.replaceState(null, "", next); }, [locale]);
  let content = <HomeScreen products={products} categories={categories}/>;
  if (screen === "catalog") content = <CatalogScreen initialProducts={products} categories={categories}/>;
  if (screen === "assistant") content = <AssistantScreen/>;
  if (screen === "cart") content = <CartScreen/>;
  if (screen === "checkout") content = <CheckoutScreen/>;
  if (screen === "product") content = <ProductScreen/>;
  if (screen === "profile") content = <ProfileScreen/>;
  const inspectorActive = screen === "assistant" && assistantView === "chat";
  return <div className="demo-shell"><section className="app-stage"><PhoneShell>{content}</PhoneShell><footer className="stage-footer"><a href="https://github.com/Weeki513/grocery-copilot" target="_blank" rel="noreferrer">GitHub repository</a><a href="https://pivnev.design" target="_blank" rel="noreferrer">pivnev.design</a></footer></section><Inspector key={inspectorActive ? "assistant" : "default"} active={inspectorActive}/></div>;
}
