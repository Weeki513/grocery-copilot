"use client";

import { ArrowLeft, Check, ChevronDown, ChevronRight, Clock3, CornerDownLeft, History, LoaderCircle, MessageSquarePlus, Plus, Send, ShieldCheck, Sparkles, Users } from "lucide-react";
import { FormEvent, Fragment, useEffect, useRef, useState } from "react";
import type { AssistantResult, ChatMessage, InspectorEvent } from "@/lib/types";
import { price, t } from "@/lib/i18n";
import { purchaseBreakdown } from "@/lib/product-quantity";
import { useGroceryStore } from "@/store/grocery-store";
import { QuantityControl } from "./quantity-control";

const prompts = {
  en: ["Build a taco dinner for four under $45.", "Plan three weekday breakfasts with minimal leftovers.", "Make shrimp pasta for under $30.", "Build a picnic basket for three people."],
  ru: ["Собери шакшуку на двоих до $25.", "Собери продукты для трёх завтраков на рабочую неделю.", "Сделай пасту с креветками дешевле $30.", "Собери салат на четверых, но без майонеза и орехов."],
};

function parseSseBlock(block: string) {
  const type = block.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
  const data = block.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
  if (!type || !data) return null;
  return { type, payload: JSON.parse(data) as unknown };
}

type RenderableResult = AssistantResult & {
  recipe: NonNullable<AssistantResult["recipe"]>;
  items: NonNullable<AssistantResult["items"]>;
};

function renderableResult(result?: AssistantResult): RenderableResult | undefined {
  return result?.status === "completed" && result.recipe && result.items ? result as RenderableResult : undefined;
}

export function AssistantScreen() {
  const store = useGroceryStore(); const { locale, navigate, assistantView: view, setAssistantView: setView, chatSessions, messages, addMessage, sessionId, startNewChat, openChat, assistantStatus, setAssistantStatus, assistantResult, setAssistantResult, setAssistantItemQuantity, addInspectorEvent, addItems } = store; const c = t(locale);
  const [input, setInput] = useState(""); const [detailsOpenFor, setDetailsOpenFor] = useState<string>(); const chatScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (view !== "chat") return;
    const frame = requestAnimationFrame(() => {
      const chat = chatScrollRef.current;
      if (chat) chat.scrollTo({ top: chat.scrollHeight, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, assistantResult, assistantStatus, view]);

  async function submit(message: string, mode: "new" | "continue") {
    const content = message.trim(); if (!content || assistantStatus === "running") return;
    const previousResult = mode === "continue" ? assistantResult : undefined;
    const conversation = mode === "continue" ? messages : [];
    const selectionContext = mode === "continue" && assistantResult?.items ? {
      recipe: assistantResult.recipe, kind: assistantResult.kind, total: assistantResult.total,
      items: assistantResult.items.map((item) => ({ id: item.product.id, name: item.product.localeData[locale].name, quantity: item.quantity, unitPrice: item.product.price, ingredientKey: item.ingredientKey })),
    } : undefined;
    const targetSessionId = mode === "new" ? startNewChat() : sessionId;
    setView("chat");
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content, createdAt: new Date().toISOString() };
    addMessage(userMessage); setInput(""); setAssistantStatus("running"); if (mode === "new") setAssistantResult(undefined);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: targetSessionId, locale, message: content, conversation, selectionContext }) });
      if (!response.ok || !response.body) throw new Error("The assistant stream could not start.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let final: AssistantResult | undefined;
      while (true) {
        const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n"); buffer = blocks.pop() || "";
        for (const block of blocks) {
          const event = parseSseBlock(block); if (!event) continue;
          if (event.type === "inspector") addInspectorEvent(event.payload as InspectorEvent);
          if (event.type === "result") final = event.payload as AssistantResult;
          if (event.type === "error") { const error = event.payload as { message: string; error: string }; final = { status: "failed", message: error.message, error: error.error }; }
        }
      }
      if (!final) throw new Error("The assistant stream ended without a result.");
      const displayedResult = !final.items?.length && previousResult?.items?.length ? previousResult : final;
      setAssistantResult(displayedResult); setAssistantStatus(final.status === "waiting" ? "waiting" : final.status === "completed" ? "completed" : "failed");
      addMessage({ id: crypto.randomUUID(), role: "assistant", content: final.message, createdAt: new Date().toISOString(), result: final.status === "completed" && final.items?.length ? displayedResult : undefined });
    } catch {
      const message = locale === "ru" ? "Не удалось подключиться к AI. Проверьте локальный сервер и повторите запрос." : "I couldn’t reach the AI service. Check the local server and try again.";
      setAssistantStatus("failed"); setAssistantResult({ status: "failed", message }); addMessage({ id: crypto.randomUUID(), role: "assistant", content: message, createdAt: new Date().toISOString() });
    }
  }

  const hasAttachedResults = messages.some((message) => message.role === "assistant" && message.result?.items?.length);
  const fallbackResultMessageId = !hasAttachedResults && assistantResult?.items?.length
    ? [...messages].reverse().find((message) => message.role === "assistant")?.id
    : undefined;
  const activeResultMessageId = [...messages].reverse().find((message) => message.role === "assistant" && message.result?.items?.length)?.id
    || fallbackResultMessageId;

  return <div className="screen assistant-screen">
    <header className="assistant-header"><button className="icon-button" aria-label={locale === "ru" ? "Назад" : "Back"} onClick={() => view === "home" ? navigate("home") : setView("home")}><ArrowLeft/></button><div><h1>{view === "history" ? (locale === "ru" ? "История чатов" : "Chat history") : c.assistantTitle}</h1><small>{view === "history" ? (locale === "ru" ? `${chatSessions.length} сохранено` : `${chatSessions.length} saved`) : c.assistantSub}</small></div>{view === "history" ? <span className="assistant-header-spacer"/> : <button className="assistant-history-button" disabled={assistantStatus === "running"} onClick={() => setView("history")} aria-label={locale === "ru" ? "История чатов" : "Chat history"}><History size={17}/></button>}</header>
    {view === "home" ? <div className="chat-scroll assistant-home-scroll">
      <div className="assistant-empty"><span className="eyebrow"><Sparkles size={12}/> Grocery Copilot</span><h2>{c.emptyChat}</h2><p>{c.emptyChatBody}</p>
        <form className="assistant-home-composer" onSubmit={(event: FormEvent) => { event.preventDefault(); submit(input, "new"); }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={c.input}/><button disabled={!input.trim() || assistantStatus === "running"} aria-label={c.send}><Send size={18}/></button></form>
        {messages.length ? <button className="continue-conversation" onClick={() => setView("chat")}>{locale === "ru" ? "Продолжить диалог" : "Continue conversation"}<ChevronRight size={14}/></button> : null}
        <div className="suggested-prompts">{prompts[locale].map((prompt) => <button key={prompt} onClick={() => submit(prompt, "new")}>{prompt}<CornerDownLeft size={14}/></button>)}</div>
      </div>
    </div> : view === "history" ? <div className="chat-scroll chat-history-screen">
      <button className="new-chat-button" onClick={() => { setInput(""); setView("home"); }}><MessageSquarePlus size={17}/><span><strong>{locale === "ru" ? "Новый чат" : "New chat"}</strong><small>{locale === "ru" ? "Начать отдельный запрос" : "Start a separate request"}</small></span></button>
      {chatSessions.length ? <div className="chat-history-list">{[...chatSessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((chat) => <button key={chat.id} className={chat.id === sessionId ? "active" : ""} onClick={() => { openChat(chat.id); setView("chat"); }}><span><strong>{chat.title}</strong><small>{chat.messages.length} {locale === "ru" ? "сообщений" : "messages"} · {chat.updatedAt.slice(0, 10)}</small></span><ChevronRight size={15}/></button>)}</div> : <div className="chat-history-empty"><History size={24}/><strong>{locale === "ru" ? "История пока пуста" : "No chats yet"}</strong><p>{locale === "ru" ? "Первый запрос появится здесь автоматически." : "Your first request will appear here automatically."}</p></div>}
    </div> : <>
      <div className="chat-scroll" ref={chatScrollRef}>
        {messages.map((message) => {
          const result = message.result || (message.id === fallbackResultMessageId ? assistantResult : undefined);
          const renderedResult = message.role === "assistant" ? renderableResult(result) : undefined;
          const editable = message.id === activeResultMessageId;
          const detailsOpen = detailsOpenFor === message.id;
          return <Fragment key={message.id}>
            <div className={`message ${message.role}`}><span>{message.content}</span></div>
            {renderedResult ? <div className="assistant-result">
              <div className="result-success"><span><Check size={17}/></span><div><small>{renderedResult.kind === "shopping" ? (locale === "ru" ? "ТОВАРЫ ПОДОБРАНЫ" : "PRODUCTS READY") : (locale === "ru" ? "ПОДБОР ГОТОВ" : "CART READY")}</small><strong>{renderedResult.recipe.title[locale]}</strong></div><b>{price(renderedResult.total || 0)}</b></div>
              <div className="recipe-stats">{renderedResult.kind === "shopping" ? <span><Check size={15}/>{renderedResult.items.length} {locale === "ru" ? "тов." : "items"}</span> : <><span><Users size={15}/>{renderedResult.recipe.servings}</span><span><Clock3 size={15}/>{renderedResult.recipe.cookingTimeMinutes} min</span></>}<span><ShieldCheck size={15}/>{locale === "ru" ? "Проверено" : "Checked"}</span></div>
              <p className="recipe-summary">{renderedResult.recipe.summary[locale]}</p>
              <div className="selected-products"><h3>{c.selection} · {renderedResult.items.reduce((sum, item) => sum + item.quantity, 0)} {locale === "ru" ? "уп." : "packs"}</h3>{renderedResult.items.map((item) => <div className="selected-row" key={item.product.id}><span className="selected-placeholder" aria-hidden/><div className="selected-copy"><strong>{item.product.localeData[locale].name}</strong><small>{purchaseBreakdown(item.product, item.quantity, locale)}</small><small>{price(item.product.price)} × {item.quantity} = {price(item.quantity * item.product.price)}</small></div><div className="assistant-item-actions"><b>{price(item.quantity * item.product.price)}</b>{editable ? <QuantityControl compact quantity={item.quantity} removeAtOne onDecrease={() => setAssistantItemQuantity(item.product.id, item.quantity - 1)} onIncrease={() => setAssistantItemQuantity(item.product.id, item.quantity + 1)} disabledIncrease={item.quantity >= item.product.stock}/> : null}</div></div>)}</div>
              <button className="primary-button add-all" disabled={!renderedResult.items.length} onClick={() => { addItems(renderedResult.items); navigate("cart"); }}><Plus size={18}/>{c.addAll}<span>{price(renderedResult.total || 0)}</span></button>
              <button className="recipe-toggle" onClick={() => setDetailsOpenFor(detailsOpen ? undefined : message.id)}>{renderedResult.kind === "shopping" ? (locale === "ru" ? "Что дальше" : "Next steps") : c.recipe}<ChevronDown className={detailsOpen ? "rotated" : ""} size={17}/></button>
              {detailsOpen ? <ol className="recipe-steps">{renderedResult.recipe.steps[locale].map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol> : null}
            </div> : null}
          </Fragment>;
        })}
        {assistantStatus === "running" ? <div className="working-card"><div className="working-head"><LoaderCircle className="spin" size={18}/><strong>{c.thinking}</strong></div><div className="working-track"><span/></div><small>{locale === "ru" ? "Проверяю наличие, упаковки и ограничения…" : "Checking availability, pack sizes, and constraints…"}</small></div> : null}
      </div>
      <form className="chat-composer" onSubmit={(event: FormEvent) => { event.preventDefault(); submit(input, "continue"); }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={assistantStatus === "waiting" ? (locale === "ru" ? "Ответьте на вопрос…" : "Answer the question…") : c.input}/><button disabled={!input.trim() || assistantStatus === "running"} aria-label={c.send}><Send size={18}/></button></form>
    </>}
  </div>;
}
