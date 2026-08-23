"use client";

import { ArrowLeft, Bell, ChevronRight, CircleHelp, CreditCard, Languages, MapPin, Package, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { useGroceryStore } from "@/store/grocery-store";

const profileCopy = {
  en: {
    title: "Profile", member: "Grocery Copilot member", points: "513 points", next: "769 points to your next $5 reward",
    account: "Account", orders: "Orders", ordersHint: "Track and reorder", addresses: "Addresses", addressesHint: "Home · 24 Garden Street",
    payment: "Payment methods", paymentHint: "Visa ···· 4242", notifications: "Notifications", notificationsHint: "Offers and delivery updates",
    preferences: "Preferences", language: "Language", help: "Help & support", privacy: "Privacy and security",
    verified: "Your account is locally stored for this prototype.", edit: "Edit profile", save: "Save changes", saved: "Changes saved",
    noOrders: "No recent orders", noOrdersBody: "Completed demo orders will appear here.", addressLabel: "Delivery address",
    paymentBody: "Default demo payment method", notificationsBody: "Delivery status and useful account updates", supportBody: "This local prototype does not send external messages.",
  },
  ru: {
    title: "Профиль", member: "Участник Grocery Copilot", points: "513 баллов", next: "Ещё 769 баллов до скидки $5",
    account: "Аккаунт", orders: "Заказы", ordersHint: "Отследить или повторить", addresses: "Адреса", addressesHint: "Дом · Garden Street, 24",
    payment: "Способы оплаты", paymentHint: "Visa ···· 4242", notifications: "Уведомления", notificationsHint: "Акции и статусы доставки",
    preferences: "Настройки", language: "Язык", help: "Помощь и поддержка", privacy: "Приватность и безопасность",
    verified: "Данные аккаунта хранятся локально для этого прототипа.", edit: "Изменить профиль", save: "Сохранить", saved: "Изменения сохранены",
    noOrders: "Недавних заказов нет", noOrdersBody: "Завершённые демо-заказы появятся здесь.", addressLabel: "Адрес доставки",
    paymentBody: "Основной демонстрационный способ оплаты", notificationsBody: "Статусы доставки и важные обновления аккаунта", supportBody: "Локальный прототип не отправляет внешние сообщения.",
  },
} as const;

type ProfileDetail = "edit" | "orders" | "addresses" | "payment" | "notifications" | "help";

export function ProfileScreen() {
  const { locale, setLocale, navigate, order } = useGroceryStore();
  const c = profileCopy[locale];
  const [detail, setDetail] = useState<ProfileDetail>();
  const [name, setName] = useState("Anton Pivnev");
  const [address, setAddress] = useState("24 Garden Street");
  const [notifications, setNotifications] = useState(true);
  const [notice, setNotice] = useState("");

  const save = (event: FormEvent) => {
    event.preventDefault();
    setNotice(c.saved);
    window.setTimeout(() => setNotice(""), 1600);
  };

  const detailTitle = detail === "edit" ? c.edit : detail === "orders" ? c.orders : detail === "addresses" ? c.addresses : detail === "payment" ? c.payment : detail === "notifications" ? c.notifications : c.help;

  if (detail) return <div className="screen profile-screen profile-detail-screen">
    <header className="screen-header"><button className="icon-button" onClick={() => setDetail(undefined)} aria-label={locale === "ru" ? "Назад" : "Back"}><ArrowLeft/></button><div><h1>{detailTitle}</h1></div><span/></header>
    {detail === "edit" ? <form className="profile-detail" onSubmit={save}><label><span>{locale === "ru" ? "Имя" : "Name"}</span><input value={name} onChange={(event) => setName(event.target.value)} required/></label><label><span>Email</span><input value="anton@example.com" readOnly/></label><button className="primary-button">{c.save}</button></form> : null}
    {detail === "orders" ? <section className="profile-detail">{order ? <div className="profile-data-card"><span>{order.id}</span><strong>{order.slot}</strong><small>{order.address}</small></div> : <div className="profile-detail-empty"><Package size={22}/><strong>{c.noOrders}</strong><p>{c.noOrdersBody}</p></div>}</section> : null}
    {detail === "addresses" ? <form className="profile-detail" onSubmit={save}><label><span>{c.addressLabel}</span><input value={address} onChange={(event) => setAddress(event.target.value)} required/></label><button className="primary-button">{c.save}</button></form> : null}
    {detail === "payment" ? <section className="profile-detail"><div className="profile-data-card"><span>{c.paymentBody}</span><strong>Visa ···· 4242</strong><small>{locale === "ru" ? "Демо-карта · списаний нет" : "Demo card · no charges"}</small></div></section> : null}
    {detail === "notifications" ? <section className="profile-detail"><label className="toggle-row"><span><strong>{c.notifications}</strong><small>{c.notificationsBody}</small></span><input type="checkbox" checked={notifications} onChange={(event) => setNotifications(event.target.checked)}/></label></section> : null}
    {detail === "help" ? <section className="profile-detail"><div className="profile-data-card"><span>{c.help}</span><strong>support@grocerycopilot.demo</strong><small>{c.supportBody}</small></div><div className="profile-data-card"><span>{c.privacy}</span><strong>{locale === "ru" ? "Локальные данные" : "Local data only"}</strong><small>{c.verified}</small></div></section> : null}
    {notice ? <div className="profile-toast" role="status">{notice}</div> : null}
  </div>;

  const rows: Array<{ icon: typeof Package; label: string; hint: string; detail: ProfileDetail }> = [
    { icon: Package, label: c.orders, hint: c.ordersHint, detail: "orders" },
    { icon: MapPin, label: c.addresses, hint: c.addressesHint, detail: "addresses" },
    { icon: CreditCard, label: c.payment, hint: c.paymentHint, detail: "payment" },
    { icon: Bell, label: c.notifications, hint: c.notificationsHint, detail: "notifications" },
  ];

  return <div className="screen profile-screen">
    <header className="screen-header"><button className="icon-button" onClick={() => navigate("home")} aria-label={locale === "ru" ? "Назад" : "Back"}><ArrowLeft/></button><div><h1>{c.title}</h1><small>{c.member}</small></div><span/></header>
    <section className="profile-card"><div className="profile-avatar">AP</div><div className="profile-identity"><h2>{name}</h2><span><ShieldCheck size={13}/>{c.member}</span></div><button onClick={() => setDetail("edit")}>{locale === "ru" ? "Изменить" : "Edit"}</button></section>
    <section className="rewards-card"><div><small>GROCERY COPILOT REWARDS</small><strong>{c.points}</strong><p>{c.next}</p><span><i/></span></div></section>
    <h3 className="profile-section-title">{c.account}</h3>
    <section className="profile-list">{rows.map((row) => { const Icon = row.icon; return <button key={row.label} onClick={() => setDetail(row.detail)}><span className="profile-row-icon"><Icon size={18}/></span><span><strong>{row.label}</strong><small>{row.hint}</small></span><ChevronRight size={17}/></button>; })}</section>
    <h3 className="profile-section-title">{c.preferences}</h3>
    <section className="profile-list"><button onClick={() => setLocale(locale === "en" ? "ru" : "en")}><span className="profile-row-icon"><Languages size={18}/></span><span><strong>{c.language}</strong><small>{locale === "en" ? "English" : "Русский"}</small></span><b>{locale === "en" ? "RU" : "EN"}</b></button><button onClick={() => setDetail("help")}><span className="profile-row-icon"><CircleHelp size={18}/></span><span><strong>{c.help}</strong><small>{c.privacy}</small></span><ChevronRight size={17}/></button></section>
    <p className="profile-footnote"><ShieldCheck size={14}/>{c.verified}</p>
  </div>;
}
