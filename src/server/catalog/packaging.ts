import type { Family } from "./families";

/**
 * Realistic retail pack sizes expressed in each family's canonical unit.
 * Keeping this data family-specific prevents unrelated products such as spices,
 * drinks and produce from sharing one arbitrary list of weights.
 */
export const PACKAGING_PROFILES: Record<string, readonly number[]> = {
  "Spaghetti": [250, 400, 500, 750, 1000],
  "Basmati Rice": [500, 1000, 2000, 5000],
  "Canned Tomatoes": [200, 400, 800],
  "Red Kidney Beans": [200, 400, 800],
  "Chickpeas": [200, 400, 800],
  "Coconut Milk": [200, 400, 500],
  "All-purpose Flour": [500, 1000, 2000],
  "Couscous": [250, 500, 1000],

  "Sparkling Water": [330, 500, 750, 1000, 1500],
  "Orange Juice": [250, 500, 1000, 1500],
  "Oat Drink": [500, 1000],
  "Cola": [330, 500, 1000, 1500, 2000],
  "Green Tea": [50, 100, 200],

  "Free Range Eggs": [6, 10, 12, 18],
  "Whole Milk": [500, 1000, 1500, 2000],
  "Greek Yogurt": [150, 300, 500, 1000],
  "Cooking Cream 10%": [200, 250, 500],
  "Feta Cheese": [100, 200, 250, 400],
  "Mozzarella": [125, 250, 400],
  "Unsalted Butter": [100, 200, 250, 500],

  "Dark Chocolate": [50, 80, 100, 200],
  "Sea Salt Crisps": [40, 80, 150, 200],
  "Roasted Almonds": [50, 100, 200, 300],
  "Oat Cookies": [100, 200, 300, 500],

  "Potatoes": [500, 1000, 1500, 2500],
  "Carrots": [250, 500, 1000],
  "Roma Tomatoes": [250, 500, 750],
  "Yellow Onion": [250, 500, 1000],
  "Fresh Garlic": [50, 100, 200],
  "Ripe Avocado": [1, 2, 4, 6],
  "Fresh Cilantro": [30, 50, 100],
  "Baby Spinach": [100, 180, 250, 450],
  "Red Bell Pepper": [150, 300, 500],
  "Lime": [1, 2, 4, 6],
  "Lemon": [1, 2, 4, 6],
  "Cucumber": [200, 450, 600],

  "Chicken Breast": [250, 400, 500, 750, 1000],
  "Lean Beef Mince": [250, 400, 500, 750, 1000],
  "Turkey Fillet": [250, 400, 500, 750, 1000],
  "Pork Tenderloin": [300, 500, 750, 1000],

  "Raw King Prawns": [200, 300, 500, 750, 1000],
  "Atlantic Salmon Fillet": [200, 300, 500, 750],
  "Tuna Steaks": [200, 300, 500, 750],
  "Cod Fillet": [200, 300, 500, 750, 1000],

  "Frozen Peas": [300, 450, 750, 1000],
  "Mixed Berries": [200, 300, 450, 750, 1000],
  "Vegetable Mix": [400, 750, 1000],
  "Margherita Pizza": [250, 300, 400, 500],

  "Chicken Caesar Bowl": [250, 300, 400, 500],
  "Vegetable Curry": [250, 300, 400, 500],
  "Tomato Soup": [300, 400, 500, 750],

  "Sourdough Loaf": [400, 500, 750],
  "Flour Tortillas": [6, 8, 10, 12],
  "Wholegrain Buns": [4, 6, 8],

  "Extra Virgin Olive Oil": [250, 500, 750, 1000],
  "Ground Cumin": [30, 50, 75, 100],
  "Smoked Paprika": [30, 50, 75, 100],
  "Ground Black Pepper": [30, 50, 75, 100],
  "Tomato Salsa": [200, 300, 500],
  "Classic Mayonnaise": [250, 500, 750],
  "Sea Salt": [250, 500, 1000],

  "Rolled Oats": [300, 500, 750, 1000],
  "Honey Granola": [250, 350, 500, 750],
  "Corn Flakes": [250, 375, 500, 750],

  "Apple Baby Purée": [90, 100, 120, 200],
  "Kitchen Surface Cleaner": [500, 750, 1000],
  "Gentle Hand Wash": [250, 300, 500],
  "Chicken Cat Food": [85, 100, 200, 400, 800],
  "Recycled Kitchen Towels": [1, 2, 4, 6],
};

export function packageSizesForFamily(family: Family) {
  const sizes = PACKAGING_PROFILES[family.en];
  if (!sizes?.length) throw new Error(`Missing packaging profile for ${family.en}.`);
  return sizes;
}
