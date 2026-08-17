import type { Category } from "@/lib/types";

export const CATEGORIES: Category[] = [
  { id: "pantry", name: { en: "Pantry & canned food", ru: "Бакалея и консервы" }, emoji: "🥫", count: 1350 },
  { id: "drinks", name: { en: "Drinks", ru: "Напитки" }, emoji: "🧃", count: 950 },
  { id: "dairy", name: { en: "Dairy & eggs", ru: "Молочные продукты и яйца" }, emoji: "🥛", count: 800 },
  { id: "snacks", name: { en: "Snacks & sweets", ru: "Снеки и сладости" }, emoji: "🍫", count: 850 },
  { id: "produce", name: { en: "Fruit, vegetables & herbs", ru: "Овощи, фрукты и зелень" }, emoji: "🥑", count: 650 },
  { id: "meat", name: { en: "Meat & poultry", ru: "Мясо и птица" }, emoji: "🍗", count: 500 },
  { id: "seafood", name: { en: "Fish & seafood", ru: "Рыба и морепродукты" }, emoji: "🍤", count: 300 },
  { id: "frozen", name: { en: "Frozen food", ru: "Замороженные продукты" }, emoji: "🧊", count: 550 },
  { id: "ready", name: { en: "Ready meals", ru: "Готовая еда" }, emoji: "🍱", count: 450 },
  { id: "bakery", name: { en: "Bakery", ru: "Выпечка" }, emoji: "🥖", count: 350 },
  { id: "condiments", name: { en: "Sauces, spices & oils", ru: "Соусы, специи и масла" }, emoji: "🫒", count: 600 },
  { id: "breakfast", name: { en: "Breakfast & cereals", ru: "Завтраки и хлопья" }, emoji: "🥣", count: 400 },
  { id: "baby", name: { en: "Baby food", ru: "Детское питание" }, emoji: "🍼", count: 200 },
  { id: "cleaning", name: { en: "Household cleaning", ru: "Уборка дома" }, emoji: "🧽", count: 650 },
  { id: "personal", name: { en: "Personal care", ru: "Личная гигиена" }, emoji: "🧴", count: 600 },
  { id: "pets", name: { en: "Pet supplies", ru: "Товары для питомцев" }, emoji: "🐾", count: 350 },
  { id: "household", name: { en: "Household essentials", ru: "Всё для дома" }, emoji: "🧻", count: 450 },
];

export const CATEGORY_TOTAL = CATEGORIES.reduce((sum, item) => sum + item.count, 0);
