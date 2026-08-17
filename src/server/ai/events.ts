import type { InspectorEvent, InspectorNode } from "@/lib/types";

type Emitter = (event: InspectorEvent) => void;
const emitters = new Map<string, Emitter>();

export function registerEmitter(sessionId: string, emitter: Emitter) { emitters.set(sessionId, emitter); }
export function unregisterEmitter(sessionId: string) { emitters.delete(sessionId); }

export function inspectorEvent(node: InspectorNode, status: InspectorEvent["status"], titleEn: string, titleRu: string, detailEn: string, detailRu: string, extra: Partial<InspectorEvent> = {}): InspectorEvent {
  return {
    id: crypto.randomUUID(), node, status,
    title: { en: titleEn, ru: titleRu }, detail: { en: detailEn, ru: detailRu },
    timestamp: new Date().toISOString(), ...extra,
  };
}

export function emitInspector(sessionId: string, event: InspectorEvent) {
  emitters.get(sessionId)?.(event);
  return [event];
}
