import { Annotation } from "@langchain/langgraph";
import type { AssistantResult, CartItem, ChatMessage, IngredientRequirement, InspectorEvent, Locale, RecipePlan } from "@/lib/types";
import type { InterpretationBundle, ProductSelection } from "./schemas";
import type { CandidateGroup } from "@/server/catalog/retrieval";
import type { ValidationError } from "@/server/validation/selection";
import type { BudgetConstraint } from "@/server/business/budget";

export type InterpretedRequest = InterpretationBundle["interpretedRequest"];

export const GroceryState = Annotation.Root({
  sessionId: Annotation<string>,
  locale: Annotation<Locale>,
  conversation: Annotation<ChatMessage[]>({ reducer: (_left, right) => right, default: () => [] }),
  currentSelection: Annotation<Array<{ productId: string; ingredientKey: string; quantity: number }>>({ reducer: (_left, right) => right, default: () => [] }),
  userRequest: Annotation<string>,
  budgetConstraint: Annotation<BudgetConstraint | undefined>,
  interpretationBundle: Annotation<InterpretationBundle | undefined>,
  interpretedRequest: Annotation<InterpretedRequest | undefined>,
  clarification: Annotation<{ required: boolean; question?: string } | undefined>,
  recipe: Annotation<RecipePlan | undefined>,
  ingredientRequirements: Annotation<IngredientRequirement[]>({ reducer: (_left, right) => right, default: () => [] }),
  candidateGroups: Annotation<CandidateGroup[]>({ reducer: (_left, right) => right, default: () => [] }),
  missingIngredientKeys: Annotation<string[]>({ reducer: (_left, right) => right, default: () => [] }),
  planningRetryCount: Annotation<number>({ reducer: (_left, right) => right, default: () => 0 }),
  scannedAfterFilters: Annotation<number>({ reducer: (_left, right) => right, default: () => 0 }),
  shortlistSize: Annotation<number>({ reducer: (_left, right) => right, default: () => 0 }),
  selection: Annotation<ProductSelection | undefined>,
  validationErrors: Annotation<ValidationError[]>({ reducer: (_left, right) => right, default: () => [] }),
  cartItems: Annotation<CartItem[]>({ reducer: (_left, right) => right, default: () => [] }),
  total: Annotation<number>({ reducer: (_left, right) => right, default: () => 0 }),
  activeModel: Annotation<string | undefined>,
  retryCount: Annotation<number>({ reducer: (_left, right) => right, default: () => 0 }),
  inspectorEvents: Annotation<InspectorEvent[]>({ reducer: (left, right) => left.concat(right), default: () => [] }),
  response: Annotation<AssistantResult | undefined>,
});

export type GroceryAgentState = typeof GroceryState.State;
