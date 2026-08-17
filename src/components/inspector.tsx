"use client";

import { AlertTriangle, Check, ChevronRight, Circle, Clock3, Cpu, Database, Gauge, Layers3, LoaderCircle, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import type { InspectorEvent, InspectorNode } from "@/lib/types";
import { t } from "@/lib/i18n";
import { useGroceryStore } from "@/store/grocery-store";

const graphNodes: Array<{ id: InspectorNode; en: string; ru: string }> = [
  { id: "route_business_request", en: "Check business fit", ru: "Проверить задачу" },
  { id: "interpret_request", en: "Understand request", ru: "Понять запрос" }, { id: "ask_clarification", en: "Clarify if needed", ru: "Уточнить детали" },
  { id: "plan_recipe", en: "Plan recipe", ru: "Составить рецепт" }, { id: "repair_plan", en: "Replan for constraints", ru: "Пересобрать под ограничения" }, { id: "normalize_ingredients", en: "Size ingredients", ru: "Рассчитать объёмы" },
  { id: "retrieve_products", en: "Search catalog", ru: "Найти товары" }, { id: "select_products", en: "Choose products", ru: "Выбрать товары" },
  { id: "validate_selection", en: "Validate selection", ru: "Проверить подбор" }, { id: "repair_selection", en: "Repair if needed", ru: "Подобрать замены" },
  { id: "fallback_model", en: "Fallback if needed", ru: "Резервная модель" }, { id: "build_cart", en: "Build cart", ru: "Собрать корзину" },
  { id: "compose_user_response", en: "Prepare answer", ru: "Подготовить ответ" },
];

function eventIcon(event?: InspectorEvent) {
  if (!event) return <Circle size={13}/>; if (event.status === "active") return <LoaderCircle className="spin" size={14}/>; if (event.status === "completed") return <Check size={14}/>; if (event.status === "warning") return <AlertTriangle size={14}/>; return <Circle size={13}/>;
}

export function Inspector() {
  const { locale, inspectorEvents: events, assistantStatus } = useGroceryStore(); const c = t(locale); const [selected, setSelected] = useState<InspectorEvent>();
  const latest = useMemo(() => { const map = new Map<InspectorNode, InspectorEvent>(); for (const event of events) map.set(event.node, event); return map; }, [events]);
  const completed = graphNodes.filter((node) => ["completed", "skipped"].includes(latest.get(node.id)?.status || "")).length; const shortlist = [...events].reverse().find((event) => event.output && "shortlist" in event.output)?.output?.shortlist as number | undefined; const model = [...events].reverse().find((event) => event.model)?.model; const latency = events.reduce((sum, event) => sum + (event.durationMs || 0), 0); const tokens = events.reduce((sum, event) => sum + (event.tokens || 0), 0);
  return <aside className="inspector-panel"><header className="inspector-header"><div className="inspector-brand"><span><Sparkles size={17}/></span><div><h1>{c.inspector}</h1><p>{c.inspectorSub}</p></div></div><span className={`run-status ${assistantStatus}`}><i/>{c[assistantStatus]}</span></header>
    <div className="metric-grid"><div><Database/><span>{c.catalogSize}</span><strong>10,000</strong></div><div><Layers3/><span>{c.shortlist}</span><strong>{shortlist ?? "—"}</strong></div><div><Cpu/><span>{c.model}</span><strong>{model?.replace("gpt-", "GPT ") || "—"}</strong></div><div><Gauge/><span>Latency</span><strong>{latency ? `${(latency / 1000).toFixed(1)}s` : "—"}</strong></div></div>
    <section className="graph-section"><div className="inspector-section-title"><div><h2>LangGraph workflow</h2><span>Single agent · server orchestrated</span></div><b>{completed}/{graphNodes.length}</b></div><div className="graph-list">{graphNodes.map((node, index) => { const event = latest.get(node.id); return <button key={node.id} className={event?.status || "pending"} onClick={() => event && setSelected(event)}><span className="graph-line">{eventIcon(event)}{index < graphNodes.length - 1 ? <i/> : null}</span><span><strong>{node[locale]}</strong><small>{event ? event.detail[locale] : (locale === "ru" ? "Ожидает" : "Pending")}</small></span>{event?.durationMs ? <time>{event.durationMs} ms</time> : null}<ChevronRight size={14}/></button>; })}</div></section>
    <section className="event-section"><div className="inspector-section-title"><div><h2>{c.events}</h2><span>{events.length} {c.steps}</span></div>{tokens ? <b>~{tokens} tok</b> : null}</div>{!events.length ? <div className="inspector-empty"><Zap size={23}/><p>{c.noEvents}</p></div> : <div className="event-list">{[...events].reverse().slice(0, 10).map((event) => <button key={event.id} onClick={() => setSelected(event)}><span className={`event-dot ${event.status}`}>{event.status === "completed" ? <Check/> : event.status === "warning" ? <AlertTriangle/> : <Clock3/>}</span><div><strong>{event.title[locale]}</strong><small>{event.detail[locale]}</small></div><time>{new Date(event.timestamp).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time></button>)}</div>}</section>
    <footer className="inspector-footer"><ShieldCheck size={15}/><span>{locale === "ru" ? "Скрытые рассуждения и секреты не отображаются" : "Hidden reasoning and secrets are never displayed"}</span></footer>
    {selected ? <div className="event-drawer"><button className="drawer-backdrop" aria-label="Close" onClick={() => setSelected(undefined)}/><div><header><span className={`event-dot ${selected.status}`}>{selected.status === "completed" ? <Check/> : <Clock3/>}</span><section><small>{selected.node}</small><h2>{selected.title[locale]}</h2></section><button onClick={() => setSelected(undefined)}>×</button></header><p>{selected.detail[locale]}</p><dl><div><dt>Status</dt><dd>{selected.status}</dd></div>{selected.model ? <div><dt>Model</dt><dd>{selected.model}</dd></div> : null}{selected.durationMs ? <div><dt>Duration</dt><dd>{selected.durationMs} ms</dd></div> : null}{selected.candidates ? <div><dt>Candidates</dt><dd>{selected.candidates}</dd></div> : null}</dl>{selected.input ? <section><h3>Safe input</h3><pre>{JSON.stringify(selected.input, null, 2)}</pre></section> : null}{selected.output ? <section><h3>Validated output</h3><pre>{JSON.stringify(selected.output, null, 2)}</pre></section> : null}</div></div> : null}
  </aside>;
}
