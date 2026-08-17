"use client";

import { ArrowLeft, Bell, ChevronRight, CircleHelp, CreditCard, Gift, Languages, MapPin, Package, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useGroceryStore } from "@/store/grocery-store";

const profileCopy = {
  en: {
    title: "Profile", member: "Grocery Copilot member", points: "513 points", next: "769 points to your next $5 reward",
    account: "Account", orders: "Orders", ordersHint: "Track and reorder", addresses: "Addresses", addressesHint: "Home · 24 Garden Street",
    payment: "Payment methods", paymentHint: "Visa ···· 4242", notifications: "Notifications", notificationsHint: "Offers and delivery updates",
    preferences: "Preferences", language: "Language", help: "Help & support", privacy: "Privacy and security",
    verified: "Your account is locally stored for this prototype.", opened: "Section opened",
  },
  ru: {
    title: "Профиль", member: "Участник Grocery Copilot", points: "513 баллов", next: "Ещё 769 баллов до скидки $5",
    account: "Аккаунт", orders: "Заказы", ordersHint: "Отследить или повторить", addresses: "Адреса", addressesHint: "Дом · Garden Street, 24",
    payment: "Способы оплаты", paymentHint: "Visa ···· 4242", notifications: "Уведомления", notificationsHint: "Акции и статусы доставки",
    preferences: "Настройки", language: "Язык", help: "Помощь и поддержка", privacy: "Приватность и безопасность",
    verified: "Данные аккаунта хранятся локально для этого прототипа.", opened: "Раздел открыт",
  },
} as const;

export function ProfileScreen() {
  const { locale, setLocale, navigate } = useGroceryStore();
  const c = profileCopy[locale];
  const [notice, setNotice] = useState("");
  const announce = (label: string) => { setNotice(`${label} · ${c.opened}`); window.setTimeout(() => setNotice(""), 1800); };
  const rows = [
    { icon: Package, label: c.orders, hint: c.ordersHint },
    { icon: MapPin, label: c.addresses, hint: c.addressesHint },
    { icon: CreditCard, label: c.payment, hint: c.paymentHint },
    { icon: Bell, label: c.notifications, hint: c.notificationsHint },
  ];
  return <div className="screen profile-screen">
    <header className="screen-header"><button className="icon-button" onClick={() => navigate("home")} aria-label={locale === "ru" ? "Назад" : "Back"}><ArrowLeft/></button><div><h1>{c.title}</h1><small>{c.member}</small></div><span/></header>
    <section className="profile-card"><div className="profile-avatar">AP</div><div className="profile-identity"><h2>Anton Pivnev</h2><span><ShieldCheck size={13}/>{c.member}</span></div><button onClick={() => announce(c.account)}>{locale === "ru" ? "Изменить" : "Edit"}</button></section>
    <section className="rewards-card"><div className="reward-icon"><Gift size={20}/></div><div><small>GROCERY COPILOT REWARDS</small><strong>{c.points}</strong><p>{c.next}</p><span><i/></span></div></section>
    <h3 className="profile-section-title">{c.account}</h3>
    <section className="profile-list">{rows.map((row) => { const Icon = row.icon; return <button key={row.label} onClick={() => announce(row.label)}><span className="profile-row-icon"><Icon size={18}/></span><span><strong>{row.label}</strong><small>{row.hint}</small></span><ChevronRight size={17}/></button>; })}</section>
    <h3 className="profile-section-title">{c.preferences}</h3>
    <section className="profile-list"><button onClick={() => setLocale(locale === "en" ? "ru" : "en")}><span className="profile-row-icon"><Languages size={18}/></span><span><strong>{c.language}</strong><small>{locale === "en" ? "English" : "Русский"}</small></span><b>{locale === "en" ? "RU" : "EN"}</b></button><button onClick={() => announce(c.help)}><span className="profile-row-icon"><CircleHelp size={18}/></span><span><strong>{c.help}</strong><small>{c.privacy}</small></span><ChevronRight size={17}/></button></section>
    <p className="profile-footnote"><ShieldCheck size={14}/>{c.verified}</p>
    {notice ? <div className="profile-toast" role="status">{notice}</div> : null}
  </div>;
}
