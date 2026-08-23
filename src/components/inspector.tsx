"use client";

import { AlertTriangle, Check, Circle, Clock3, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { InspectorEvent, InspectorNode } from "@/lib/types";
import { t } from "@/lib/i18n";
import { useGroceryStore } from "@/store/grocery-store";

const graphNodes: Array<{ id: InspectorNode; en: string; ru: string }> = [
  { id: "route_business_request", en: "Check business fit", ru: "Проверить задачу" },
  { id: "interpret_request", en: "Understand request", ru: "Понять запрос" },
  { id: "ask_clarification", en: "Clarify if needed", ru: "Уточнить детали" },
  { id: "plan_recipe", en: "Plan recipe", ru: "Составить рецепт" },
  { id: "repair_plan", en: "Replan for constraints", ru: "Учесть ограничения" },
  { id: "normalize_ingredients", en: "Size ingredients", ru: "Рассчитать объёмы" },
  { id: "retrieve_products", en: "Search catalog", ru: "Найти товары" },
  { id: "select_products", en: "Choose products", ru: "Выбрать товары" },
  { id: "validate_selection", en: "Validate selection", ru: "Проверить подбор" },
  { id: "repair_selection", en: "Repair if needed", ru: "Подобрать замены" },
  { id: "fallback_model", en: "Fallback if needed", ru: "Резервная модель" },
  { id: "build_cart", en: "Build cart", ru: "Собрать корзину" },
  { id: "compose_user_response", en: "Prepare answer", ru: "Подготовить ответ" },
];

function EventIcon({ event }: { event?: InspectorEvent }) {
  if (!event) return <Circle size={10} />;
  if (event.status === "active") return <LoaderCircle className="spin" size={11} />;
  if (event.status === "completed") return <Check size={11} />;
  if (event.status === "warning") return <AlertTriangle size={11} />;
  return <Circle size={10} />;
}

export function Inspector() {
  const { locale, inspectorEvents: events, assistantStatus } = useGroceryStore();
  const c = t(locale);
  const [selected, setSelected] = useState<InspectorEvent>();
  const latest = useMemo(() => {
    const map = new Map<InspectorNode, InspectorEvent>();
    for (const event of events) map.set(event.node, event);
    return map;
  }, [events]);
  const completed = graphNodes.filter((node) => ["completed", "skipped"].includes(latest.get(node.id)?.status || "")).length;
  const shortlist = [...events].reverse().find((event) => event.output && "shortlist" in event.output)?.output?.shortlist as number | undefined;
  const model = [...events].reverse().find((event) => event.model)?.model;
  const latency = events.reduce((sum, event) => sum + (event.durationMs || 0), 0);
  const tokens = events.reduce((sum, event) => sum + (event.tokens || 0), 0);

  return <aside className="inspector-panel">
    <header className="inspector-header"><h1>{c.inspector}</h1><span className={`run-status ${assistantStatus}`}><i />{c[assistantStatus]}</span></header>
    <div className="metric-grid">
      <div><span>{c.catalogSize}</span><strong>10,000</strong></div>
      <div><span>{c.shortlist}</span><strong>{shortlist ?? "—"}</strong></div>
      <div><span>{c.model}</span><strong>{model?.replace("gpt-", "GPT ") || "—"}</strong></div>
      <div><span>Latency</span><strong>{latency ? `${(latency / 1000).toFixed(1)}s` : "—"}</strong></div>
    </div>
    <section className="graph-section">
      <div className="inspector-section-title"><h2>LangGraph workflow</h2><b>{completed}/{graphNodes.length}</b></div>
      <div className="graph-list">{graphNodes.map((node) => {
        const event = latest.get(node.id);
        const content = <><span className="graph-dot"><EventIcon event={event} /></span><span><strong>{node[locale]}</strong>{event ? <small>{event.detail[locale]}</small> : null}</span>{event?.durationMs ? <time>{event.durationMs} ms</time> : null}</>;
        return event ? <button key={node.id} className={event.status} onClick={() => setSelected(event)}>{content}</button> : <div key={node.id} className="graph-row pending">{content}</div>;
      })}</div>
    </section>
    <section className="event-section">
      <div className="inspector-section-title"><h2>{c.events}</h2><span>{events.length} {c.steps}{tokens ? ` · ~${tokens} tok` : ""}</span></div>
      {events.length ? <div className="event-list">{[...events].reverse().slice(0, 10).map((event) => <button key={event.id} onClick={() => setSelected(event)}><span className={`event-dot ${event.status}`}>{event.status === "completed" ? <Check /> : event.status === "warning" ? <AlertTriangle /> : <Clock3 />}</span><div><strong>{event.title[locale]}</strong><small>{event.detail[locale]}</small></div><time>{new Date(event.timestamp).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time></button>)}</div> : <div className="inspector-empty" />}
    </section>
    {selected ? <div className="event-drawer"><button className="drawer-backdrop" aria-label="Close" onClick={() => setSelected(undefined)} /><div><header><span className={`event-dot ${selected.status}`}>{selected.status === "completed" ? <Check /> : <Clock3 />}</span><section><small>{selected.node}</small><h2>{selected.title[locale]}</h2></section><button onClick={() => setSelected(undefined)}>×</button></header><p>{selected.detail[locale]}</p><dl><div><dt>Status</dt><dd>{selected.status}</dd></div>{selected.model ? <div><dt>Model</dt><dd>{selected.model}</dd></div> : null}{selected.durationMs ? <div><dt>Duration</dt><dd>{selected.durationMs} ms</dd></div> : null}{selected.candidates ? <div><dt>Candidates</dt><dd>{selected.candidates}</dd></div> : null}</dl>{selected.input ? <section><h3>Safe input</h3><pre>{JSON.stringify(selected.input, null, 2)}</pre></section> : null}{selected.output ? <section><h3>Validated output</h3><pre>{JSON.stringify(selected.output, null, 2)}</pre></section> : null}</div></div> : null}
  </aside>;
}
