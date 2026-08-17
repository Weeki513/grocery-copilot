"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AssistantResult, AssistantStatus, CartItem, ChatMessage, ChatSession, InspectorEvent, Locale, Order, Product } from "@/lib/types";

export type Screen = "home" | "catalog" | "assistant" | "cart" | "checkout" | "product" | "profile";

type Store = {
  locale: Locale; screen: Screen; previousScreen: Screen; cart: Record<string, CartItem>; selectedProduct?: Product;
  catalogAutofocus: boolean;
  chatSessions: ChatSession[]; messages: ChatMessage[]; inspectorEvents: InspectorEvent[]; assistantStatus: AssistantStatus;
  assistantResult?: AssistantResult; sessionId: string; order?: Order;
  setLocale: (locale: Locale) => void; navigate: (screen: Screen) => void; selectProduct: (product: Product) => void;
  openCatalogWithFocus: () => void; consumeCatalogAutofocus: () => void;
  startNewChat: () => string; openChat: (id: string) => void;
  addItem: (product: Product, quantity?: number, reason?: string) => void; addItems: (items: CartItem[]) => void;
  setQuantity: (id: string, quantity: number) => void; clearCart: () => void; addMessage: (message: ChatMessage) => void;
  setAssistantItemQuantity: (id: string, quantity: number) => void;
  addInspectorEvent: (event: InspectorEvent) => void; clearInspector: () => void;
  setAssistantStatus: (status: Store["assistantStatus"]) => void; setAssistantResult: (result?: AssistantResult) => void; setOrder: (order?: Order) => void;
};

type PersistedStore = Pick<Store, "locale" | "cart" | "chatSessions" | "messages" | "inspectorEvents" | "assistantResult" | "sessionId" | "order"> & {
  assistantStatus: Exclude<AssistantStatus, "running">;
};

function makeChat(id: string, locale: Locale): ChatSession {
  const now = new Date().toISOString();
  return { id, title: locale === "ru" ? "Новый чат" : "New chat", createdAt: now, updatedAt: now, messages: [], inspectorEvents: [], assistantStatus: "idle" };
}

function titleFromMessages(messages: ChatMessage[], locale: Locale) {
  const firstRequest = messages.find((message) => message.role === "user")?.content.trim();
  if (!firstRequest) return locale === "ru" ? "Новый чат" : "New chat";
  return firstRequest.length > 42 ? `${firstRequest.slice(0, 42).trim()}…` : firstRequest;
}

function updateActiveChat(state: Store, update: Partial<ChatSession>) {
  const now = new Date().toISOString();
  return state.chatSessions.map((chat) => chat.id === state.sessionId ? { ...chat, ...update, updatedAt: now } : chat);
}

export const useGroceryStore = create<Store>()(persist<Store, [], [], PersistedStore>((set) => ({
  locale: "en", screen: "home", previousScreen: "home", cart: {}, catalogAutofocus: false, chatSessions: [], messages: [], inspectorEvents: [], assistantStatus: "idle",
  sessionId: crypto.randomUUID(),
  setLocale: (locale) => set({ locale }),
  navigate: (screen) => set((state) => ({ previousScreen: state.screen, screen })),
  openCatalogWithFocus: () => set((state) => ({ previousScreen: state.screen, screen: "catalog", catalogAutofocus: true })),
  consumeCatalogAutofocus: () => set({ catalogAutofocus: false }),
  startNewChat: () => {
    const id = crypto.randomUUID();
    set((state) => ({
      sessionId: id,
      chatSessions: [makeChat(id, state.locale), ...state.chatSessions],
      messages: [], inspectorEvents: [], assistantStatus: "idle", assistantResult: undefined,
    }));
    return id;
  },
  openChat: (id) => set((state) => {
    const chat = state.chatSessions.find((candidate) => candidate.id === id);
    if (!chat) return {};
    return {
      sessionId: chat.id,
      messages: chat.messages,
      inspectorEvents: chat.inspectorEvents,
      assistantStatus: chat.assistantStatus === "running" ? "failed" : chat.assistantStatus,
      assistantResult: chat.assistantResult,
    };
  }),
  selectProduct: (selectedProduct) => set((state) => ({ selectedProduct, previousScreen: state.screen, screen: "product" })),
  addItem: (product, quantity = 1, reason) => set((state) => ({ cart: { ...state.cart, [product.id]: { product, reason, quantity: (state.cart[product.id]?.quantity || 0) + quantity } } })),
  addItems: (items) => set((state) => {
    const cart = { ...state.cart };
    for (const item of items) cart[item.product.id] = { ...item, quantity: (cart[item.product.id]?.quantity || 0) + item.quantity };
    return { cart };
  }),
  setQuantity: (id, quantity) => set((state) => { const cart = { ...state.cart }; if (quantity <= 0) delete cart[id]; else if (cart[id]) cart[id] = { ...cart[id], quantity }; return { cart }; }),
  clearCart: () => set({ cart: {} }),
  setAssistantItemQuantity: (id, quantity) => set((state) => {
    if (!state.assistantResult?.items) return {};
    const items = quantity <= 0
      ? state.assistantResult.items.filter((item) => item.product.id !== id)
      : state.assistantResult.items.map((item) => item.product.id === id ? { ...item, quantity: Math.min(quantity, item.product.stock) } : item);
    const total = Math.round(items.reduce((sum, item) => sum + item.product.price * item.quantity, 0) * 100) / 100;
    const assistantResult = { ...state.assistantResult, items, total };
    return { assistantResult, chatSessions: updateActiveChat(state, { assistantResult }) };
  }),
  addMessage: (message) => set((state) => {
    const messages = [...state.messages, message];
    return { messages, chatSessions: updateActiveChat(state, { messages, title: titleFromMessages(messages, state.locale) }) };
  }),
  addInspectorEvent: (event) => set((state) => {
    const inspectorEvents = [...state.inspectorEvents, event].slice(-80);
    return { inspectorEvents, chatSessions: updateActiveChat(state, { inspectorEvents }) };
  }),
  clearInspector: () => set((state) => ({ inspectorEvents: [], chatSessions: updateActiveChat(state, { inspectorEvents: [] }) })),
  setAssistantStatus: (assistantStatus) => set((state) => ({ assistantStatus, chatSessions: updateActiveChat(state, { assistantStatus }) })),
  setAssistantResult: (assistantResult) => set((state) => ({ assistantResult, chatSessions: updateActiveChat(state, { assistantResult }) })),
  setOrder: (order) => set({ order }),
}), {
  name: "ladle-grocery-state", version: 2,
  migrate: (persisted, version) => {
    const state = persisted as Partial<PersistedStore>;
    const messages = state.messages || [];
    const id = state.sessionId || crypto.randomUUID();
    const now = messages.at(-1)?.createdAt || new Date().toISOString();
    const migratedSessions: ChatSession[] = messages.length ? [{
      id, title: titleFromMessages(messages, state.locale || "en"), createdAt: messages[0]?.createdAt || now, updatedAt: now,
      messages, inspectorEvents: [], assistantStatus: "idle",
    }] : [];
    return {
      locale: state.locale || "en",
      cart: state.cart || {},
      chatSessions: version >= 2 && state.chatSessions ? state.chatSessions : migratedSessions,
      messages,
      inspectorEvents: version >= 2 ? state.inspectorEvents || [] : [],
      assistantStatus: state.assistantStatus || "idle",
      assistantResult: version >= 2 ? state.assistantResult : undefined,
      sessionId: id,
      order: state.order,
    };
  },
  partialize: (state): PersistedStore => ({
    locale: state.locale, cart: state.cart, chatSessions: state.chatSessions, messages: state.messages,
    inspectorEvents: state.inspectorEvents, assistantStatus: state.assistantStatus === "running" ? "failed" : state.assistantStatus,
    assistantResult: state.assistantResult, sessionId: state.sessionId, order: state.order,
  }),
}));
