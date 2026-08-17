import type { Locale, Product } from "./types";

export type BaseQuantityUnit = "g" | "ml" | "piece";

export function productCapacity(product: Product) {
  if (product.packageQuantity && product.unitType !== "weight" && !product.netWeight) return product.packageQuantity;
  const value = product.netWeight || product.packageQuantity || 1;
  return product.weightUnit === "kg" || product.weightUnit === "l" ? value * 1000 : value;
}

export function productCapacityUnit(product: Product): BaseQuantityUnit {
  if (product.weightUnit === "ml" || product.weightUnit === "l") return "ml";
  if (product.weightUnit === "g" || product.weightUnit === "kg") return "g";
  return "piece";
}

function number(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", { maximumFractionDigits: 2 }).format(value);
}

export function formatBaseQuantity(value: number, unit: BaseQuantityUnit, locale: Locale) {
  if (unit === "g" && value >= 1000) return `${number(value / 1000, locale)} ${locale === "ru" ? "кг" : "kg"}`;
  if (unit === "ml" && value >= 1000) return `${number(value / 1000, locale)} ${locale === "ru" ? "л" : "L"}`;
  if (unit === "piece") return `${number(value, locale)} ${locale === "ru" ? "шт." : value === 1 ? "pc" : "pcs"}`;
  return `${number(value, locale)} ${unit === "ml" && locale === "ru" ? "мл" : unit === "g" && locale === "ru" ? "г" : unit}`;
}

export function purchaseBreakdown(product: Product, quantity: number, locale: Locale) {
  const unit = productCapacityUnit(product);
  const packAmount = formatBaseQuantity(productCapacity(product), unit, locale);
  const totalAmount = formatBaseQuantity(productCapacity(product) * quantity, unit, locale);
  const packs = locale === "ru" ? `${quantity} уп.` : `${quantity} ${quantity === 1 ? "pack" : "packs"}`;
  return `${packs} × ${packAmount} = ${totalAmount}`;
}
