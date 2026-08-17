export type EvalCase = { id: string; kind: "normal" | "constraint" | "stock" | "budget" | "fallback"; locale: "en" | "ru"; prompt: string; budget?: number; forbidden?: string[]; expectFallback?: boolean };

export const evalCases: EvalCase[] = [
  { id: "normal-1", kind: "normal", locale: "en", prompt: "Build a taco dinner for four." },
  { id: "normal-2", kind: "normal", locale: "en", prompt: "Make shrimp pasta for two." },
  { id: "normal-3", kind: "normal", locale: "en", prompt: "Plan shakshuka for two." },
  { id: "normal-4", kind: "normal", locale: "en", prompt: "Build a simple salmon dinner for three." },
  { id: "normal-5", kind: "normal", locale: "ru", prompt: "Собери овощное карри на двоих." },
  { id: "normal-6", kind: "normal", locale: "ru", prompt: "Собери быстрый завтрак на одного." },
  { id: "normal-7", kind: "normal", locale: "ru", prompt: "Сделай ужин с курицей на четверых." },
  { id: "normal-8", kind: "normal", locale: "en", prompt: "Build a picnic basket for three people." },
  { id: "constraint-1", kind: "constraint", locale: "en", prompt: "Quick dairy-free dinner for two.", forbidden: ["milk"] },
  { id: "constraint-2", kind: "constraint", locale: "ru", prompt: "Салат на четверых без майонеза и орехов.", forbidden: ["nuts", "mayonnaise"] },
  { id: "constraint-3", kind: "constraint", locale: "en", prompt: "Gluten-free taco dinner for four.", forbidden: ["gluten"] },
  { id: "constraint-4", kind: "constraint", locale: "ru", prompt: "Ужин без рыбы, яиц и молочных продуктов.", forbidden: ["fish", "egg", "milk"] },
  { id: "stock-1", kind: "stock", locale: "en", prompt: "Make shrimp pasta; replace anything unavailable." },
  { id: "stock-2", kind: "stock", locale: "ru", prompt: "Собери шакшуку и замени закончившиеся товары." },
  { id: "stock-3", kind: "stock", locale: "en", prompt: "Build tacos and use in-stock alternatives only." },
  { id: "budget-1", kind: "budget", locale: "en", prompt: "Make shrimp pasta for under $30.", budget: 30 },
  { id: "budget-2", kind: "budget", locale: "ru", prompt: "Собери шакшуку на двоих до $25.", budget: 25 },
  { id: "budget-3", kind: "budget", locale: "en", prompt: "Build taco dinner for four under $45.", budget: 45 },
  { id: "fallback-1", kind: "fallback", locale: "en", prompt: "Plan a starter, two mains and dessert for six under $90, dairy-free, nut-free and under 45 minutes.", expectFallback: true },
  { id: "fallback-2", kind: "fallback", locale: "ru", prompt: "Собери три блюда на восемь человек до $100 без глютена, молочных продуктов, орехов и рыбы.", expectFallback: true },
];
