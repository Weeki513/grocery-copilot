"use client";

import { Minus, Plus, Trash2 } from "lucide-react";

type QuantityControlProps = {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  removeAtOne?: boolean;
  compact?: boolean;
  disabledIncrease?: boolean;
};

export function QuantityControl({ quantity, onDecrease, onIncrease, removeAtOne = false, compact = false, disabledIncrease = false }: QuantityControlProps) {
  return <div className={`quantity-control${compact ? " compact" : ""}`}>
    <button onClick={onDecrease} aria-label={quantity === 1 && removeAtOne ? "Remove item" : "Decrease quantity"}>{quantity === 1 && removeAtOne ? <Trash2 size={14}/> : <Minus size={14}/>}</button>
    <strong>{quantity}</strong>
    <button onClick={onIncrease} disabled={disabledIncrease} aria-label="Increase quantity"><Plus size={14}/></button>
  </div>;
}
