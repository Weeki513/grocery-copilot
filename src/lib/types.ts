export type Locale = "en" | "ru";

export type Product = {
  id: string;
  sku: string;
  barcode?: string;
  localeData: Record<Locale, { name: string; description?: string }>;
  brand?: string;
  categoryId: string;
  subcategoryId: string;
  price: number;
  previousPrice?: number;
  currency: "USD";
  unitType: "piece" | "pack" | "weight";
  packageQuantity?: number;
  netWeight?: number;
  weightUnit?: "g" | "kg" | "ml" | "l";
  estimatedWeight?: boolean;
  ingredients?: string[];
  allergens?: string[];
  dietaryTags?: string[];
  searchTerms: string[];
  stock: number;
  inStock: boolean;
  lowStock: boolean;
  imageType: "emoji";
  imageValue: string;
  storageInstructions?: string;
  countryOfOrigin?: string;
  popularityScore: number;
  dataQualityFlags: string[];
};

export type Category = {
  id: string;
  name: Record<Locale, string>;
  emoji: string;
  count: number;
};

export type CartItem = { product: Product; quantity: number; reason?: string; ingredientKey?: string };

export type RecipePlan = {
  title: Record<Locale, string>;
  summary: Record<Locale, string>;
  servings: number;
  cookingTimeMinutes: number;
  steps: Record<Locale, string[]>;
};

export type IngredientRequirement = {
  key: string;
  displayName: Record<Locale, string>;
  quantity: number;
  quantityPerServing?: number;
  servingsCovered?: number;
  unit: "g" | "ml" | "piece";
  required: boolean;
  servingGroupIds?: string[];
  requiredDietaryTags?: string[];
  searchTerms: string[];
};

export type InspectorNode =
  | "route_business_request"
  | "interpret_request"
  | "ask_clarification"
  | "plan_recipe"
  | "repair_plan"
  | "normalize_ingredients"
  | "retrieve_products"
  | "select_products"
  | "validate_selection"
  | "repair_selection"
  | "fallback_model"
  | "build_cart"
  | "compose_user_response";

export type InspectorEvent = {
  id: string;
  node: InspectorNode;
  status: "active" | "completed" | "warning" | "failed" | "skipped";
  title: Record<Locale, string>;
  detail: Record<Locale, string>;
  timestamp: string;
  durationMs?: number;
  model?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  candidates?: number;
  tokens?: number;
};

export type AssistantResult = {
  status: "waiting" | "completed" | "failed";
  kind?: "meal" | "shopping";
  message: string;
  recipe?: RecipePlan;
  items?: CartItem[];
  total?: number;
  error?: string;
};

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: string };

export type AssistantStatus = "idle" | "running" | "waiting" | "completed" | "failed";

export type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  inspectorEvents: InspectorEvent[];
  assistantStatus: AssistantStatus;
  assistantResult?: AssistantResult;
};

export type Order = {
  id: string;
  createdAt: string;
  total: number;
  status: "confirmed";
  address: string;
  slot: string;
};
