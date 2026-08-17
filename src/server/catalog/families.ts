export type Family = {
  en: string;
  ru: string;
  emoji: string;
  terms: string[];
  ingredients?: string[];
  allergens?: string[];
  tags?: string[];
  roles?: Array<"protein">;
  unit?: "g" | "ml" | "piece";
};

export const FAMILIES: Record<string, Family[]> = {
  pantry: [
    { en: "Spaghetti", ru: "Спагетти", emoji: "🍝", terms: ["pasta", "spaghetti", "макароны", "паста"], ingredients: ["durum wheat"], allergens: ["gluten"], unit: "g" },
    { en: "Basmati Rice", ru: "Рис басмати", emoji: "🍚", terms: ["rice", "рис"], tags: ["vegan", "gluten-free"], unit: "g" },
    { en: "Canned Tomatoes", ru: "Томаты консервированные", emoji: "🍅", terms: ["tomato", "tomatoes", "томат", "помидоры"], tags: ["vegan"], unit: "g" },
    { en: "Red Kidney Beans", ru: "Красная фасоль", emoji: "🫘", terms: ["beans", "kidney beans", "фасоль"], tags: ["vegan"], roles: ["protein"], unit: "g" },
    { en: "Chickpeas", ru: "Нут", emoji: "🫘", terms: ["chickpeas", "garbanzo", "нут"], tags: ["vegan"], roles: ["protein"], unit: "g" },
    { en: "Coconut Milk", ru: "Кокосовое молоко", emoji: "🥥", terms: ["coconut milk", "кокосовое молоко", "dairy free"], tags: ["vegan", "dairy-free"], unit: "ml" },
    { en: "All-purpose Flour", ru: "Пшеничная мука", emoji: "🌾", terms: ["flour", "мука"], ingredients: ["wheat"], allergens: ["gluten"], unit: "g" },
    { en: "Couscous", ru: "Кускус", emoji: "🌾", terms: ["couscous", "кускус"], allergens: ["gluten"], unit: "g" },
  ],
  drinks: [
    { en: "Sparkling Water", ru: "Газированная вода", emoji: "💧", terms: ["water", "sparkling", "вода"], tags: ["vegan"], unit: "ml" },
    { en: "Orange Juice", ru: "Апельсиновый сок", emoji: "🍊", terms: ["orange juice", "juice", "сок"], tags: ["vegan"], unit: "ml" },
    { en: "Oat Drink", ru: "Овсяный напиток", emoji: "🥛", terms: ["oat milk", "oat drink", "овсяное молоко"], tags: ["vegan", "dairy-free"], unit: "ml" },
    { en: "Cola", ru: "Кола", emoji: "🥤", terms: ["cola", "soda", "кола"], unit: "ml" },
    { en: "Green Tea", ru: "Зелёный чай", emoji: "🍵", terms: ["tea", "green tea", "чай"], tags: ["vegan"], unit: "g" },
  ],
  dairy: [
    { en: "Free Range Eggs", ru: "Яйца свободного выгула", emoji: "🥚", terms: ["egg", "eggs", "яйцо", "яйца"], allergens: ["egg"], roles: ["protein"], unit: "piece" },
    { en: "Whole Milk", ru: "Цельное молоко", emoji: "🥛", terms: ["milk", "whole milk", "cow milk", "молоко", "цельное молоко", "коровье молоко"], allergens: ["milk"], roles: ["protein"], unit: "ml" },
    { en: "Greek Yogurt", ru: "Греческий йогурт", emoji: "🥛", terms: ["yogurt", "greek yogurt", "йогурт"], allergens: ["milk"], roles: ["protein"], unit: "g" },
    { en: "Cooking Cream 10%", ru: "Сливки 10%", emoji: "🥛", terms: ["cream", "cooking cream", "сливки"], allergens: ["milk"], unit: "ml" },
    { en: "Feta Cheese", ru: "Сыр фета", emoji: "🧀", terms: ["feta", "cheese", "сыр", "фета"], allergens: ["milk"], unit: "g" },
    { en: "Mozzarella", ru: "Моцарелла", emoji: "🧀", terms: ["mozzarella", "cheese", "моцарелла"], allergens: ["milk"], unit: "g" },
    { en: "Unsalted Butter", ru: "Сливочное масло", emoji: "🧈", terms: ["butter", "масло сливочное"], allergens: ["milk"], unit: "g" },
  ],
  snacks: [
    { en: "Dark Chocolate", ru: "Тёмный шоколад", emoji: "🍫", terms: ["chocolate", "dessert", "шоколад", "десерт"], allergens: ["soy"], unit: "g" },
    { en: "Sea Salt Crisps", ru: "Чипсы с морской солью", emoji: "🥔", terms: ["chips", "crisps", "чипсы"], tags: ["vegan"], unit: "g" },
    { en: "Roasted Almonds", ru: "Жареный миндаль", emoji: "🥜", terms: ["nuts", "almonds", "орехи", "миндаль"], allergens: ["nuts"], unit: "g" },
    { en: "Oat Cookies", ru: "Овсяное печенье", emoji: "🍪", terms: ["cookies", "dessert", "печенье"], allergens: ["gluten", "milk"], unit: "g" },
  ],
  produce: [
    { en: "Potatoes", ru: "Картофель", emoji: "🥔", terms: ["potato", "potatoes", "картофель", "картошка"], tags: ["vegan"], unit: "g" },
    { en: "Carrots", ru: "Морковь", emoji: "🥕", terms: ["carrot", "carrots", "морковь"], tags: ["vegan"], unit: "g" },
    { en: "Roma Tomatoes", ru: "Томаты рома", emoji: "🍅", terms: ["tomato", "tomatoes", "помидор", "томаты"], tags: ["vegan"], unit: "g" },
    { en: "Yellow Onion", ru: "Жёлтый лук", emoji: "🧅", terms: ["onion", "лук"], tags: ["vegan"], unit: "g" },
    { en: "Fresh Garlic", ru: "Свежий чеснок", emoji: "🧄", terms: ["garlic", "чеснок"], tags: ["vegan"], unit: "g" },
    { en: "Ripe Avocado", ru: "Спелый авокадо", emoji: "🥑", terms: ["avocado", "авокадо"], tags: ["vegan"], unit: "piece" },
    { en: "Fresh Cilantro", ru: "Свежая кинза", emoji: "🌿", terms: ["cilantro", "coriander", "кинза"], tags: ["vegan"], unit: "g" },
    { en: "Baby Spinach", ru: "Молодой шпинат", emoji: "🥬", terms: ["spinach", "шпинат", "greens"], tags: ["vegan"], unit: "g" },
    { en: "Red Bell Pepper", ru: "Красный сладкий перец", emoji: "🫑", terms: ["pepper", "bell pepper", "перец"], tags: ["vegan"], unit: "g" },
    { en: "Lime", ru: "Лайм", emoji: "🍋", terms: ["lime", "лайм"], tags: ["vegan"], unit: "piece" },
    { en: "Lemon", ru: "Лимон", emoji: "🍋", terms: ["lemon", "лимон"], tags: ["vegan"], unit: "piece" },
    { en: "Cucumber", ru: "Огурец", emoji: "🥒", terms: ["cucumber", "огурец"], tags: ["vegan"], unit: "g" },
  ],
  meat: [
    { en: "Chicken Breast", ru: "Куриная грудка", emoji: "🍗", terms: ["chicken", "chicken breast", "курица", "грудка"], roles: ["protein"], unit: "g" },
    { en: "Lean Beef Mince", ru: "Говяжий фарш", emoji: "🥩", terms: ["beef", "mince", "ground beef", "говядина", "фарш"], roles: ["protein"], unit: "g" },
    { en: "Turkey Fillet", ru: "Филе индейки", emoji: "🍗", terms: ["turkey", "индейка"], roles: ["protein"], unit: "g" },
    { en: "Pork Tenderloin", ru: "Свиная вырезка", emoji: "🥩", terms: ["pork", "свинина"], roles: ["protein"], unit: "g" },
  ],
  seafood: [
    { en: "Raw King Prawns", ru: "Королевские креветки", emoji: "🍤", terms: ["shrimp", "prawns", "креветки"], allergens: ["shellfish"], roles: ["protein"], unit: "g" },
    { en: "Atlantic Salmon Fillet", ru: "Филе атлантического лосося", emoji: "🐟", terms: ["salmon", "fish", "лосось", "рыба"], allergens: ["fish"], roles: ["protein"], unit: "g" },
    { en: "Tuna Steaks", ru: "Стейки тунца", emoji: "🐟", terms: ["tuna", "fish", "тунец"], allergens: ["fish"], roles: ["protein"], unit: "g" },
    { en: "Cod Fillet", ru: "Филе трески", emoji: "🐟", terms: ["cod", "fish", "треска"], allergens: ["fish"], roles: ["protein"], unit: "g" },
  ],
  frozen: [
    { en: "Frozen Peas", ru: "Замороженный горошек", emoji: "🫛", terms: ["peas", "горошек"], tags: ["vegan"], unit: "g" },
    { en: "Mixed Berries", ru: "Смесь ягод", emoji: "🫐", terms: ["berries", "ягоды"], tags: ["vegan"], unit: "g" },
    { en: "Vegetable Mix", ru: "Овощная смесь", emoji: "🥦", terms: ["vegetables", "овощи"], tags: ["vegan"], unit: "g" },
    { en: "Margherita Pizza", ru: "Пицца Маргарита", emoji: "🍕", terms: ["pizza", "пицца"], allergens: ["milk", "gluten"], unit: "g" },
  ],
  ready: [
    { en: "Chicken Caesar Bowl", ru: "Боул Цезарь с курицей", emoji: "🥗", terms: ["ready meal", "salad", "готовая еда", "салат"], allergens: ["milk", "egg"], unit: "g" },
    { en: "Vegetable Curry", ru: "Овощное карри", emoji: "🍛", terms: ["curry", "ready meal", "карри"], tags: ["vegan"], unit: "g" },
    { en: "Tomato Soup", ru: "Томатный суп", emoji: "🥣", terms: ["soup", "tomato", "суп"], tags: ["vegetarian"], unit: "g" },
  ],
  bakery: [
    { en: "Sourdough Loaf", ru: "Хлеб на закваске", emoji: "🍞", terms: ["bread", "sourdough", "хлеб"], allergens: ["gluten"], unit: "g" },
    { en: "Flour Tortillas", ru: "Пшеничные тортильи", emoji: "🫓", terms: ["tortilla", "taco", "тортилья", "тако"], allergens: ["gluten"], unit: "piece" },
    { en: "Wholegrain Buns", ru: "Цельнозерновые булочки", emoji: "🥯", terms: ["bun", "bread", "булочка"], allergens: ["gluten"], unit: "piece" },
  ],
  condiments: [
    { en: "Extra Virgin Olive Oil", ru: "Оливковое масло Extra Virgin", emoji: "🫒", terms: ["olive oil", "oil", "оливковое масло"], tags: ["vegan"], unit: "ml" },
    { en: "Ground Cumin", ru: "Молотый кумин", emoji: "🧂", terms: ["cumin", "кумин", "зира", "spice"], tags: ["vegan"], unit: "g" },
    { en: "Smoked Paprika", ru: "Копчёная паприка", emoji: "🌶️", terms: ["paprika", "паприка", "spice"], tags: ["vegan"], unit: "g" },
    { en: "Ground Black Pepper", ru: "Молотый чёрный перец", emoji: "🧂", terms: ["black pepper", "ground pepper", "peppercorn", "чёрный перец", "черный перец"], tags: ["vegan"], unit: "g" },
    { en: "Tomato Salsa", ru: "Томатная сальса", emoji: "🌶️", terms: ["salsa", "taco", "сальса"], tags: ["vegan"], unit: "g" },
    { en: "Classic Mayonnaise", ru: "Классический майонез", emoji: "🥫", terms: ["mayonnaise", "mayo", "майонез"], allergens: ["egg"], unit: "ml" },
    { en: "Sea Salt", ru: "Морская соль", emoji: "🧂", terms: ["salt", "соль"], tags: ["vegan"], unit: "g" },
  ],
  breakfast: [
    { en: "Rolled Oats", ru: "Овсяные хлопья", emoji: "🥣", terms: ["oats", "oatmeal", "овсянка", "хлопья"], allergens: ["gluten"], unit: "g" },
    { en: "Honey Granola", ru: "Гранола с мёдом", emoji: "🥣", terms: ["granola", "breakfast", "гранола"], allergens: ["gluten", "nuts"], unit: "g" },
    { en: "Corn Flakes", ru: "Кукурузные хлопья", emoji: "🥣", terms: ["cereal", "corn flakes", "хлопья"], unit: "g" },
  ],
  baby: [{ en: "Apple Baby Purée", ru: "Детское яблочное пюре", emoji: "🍎", terms: ["baby food", "puree", "детское питание", "пюре"], unit: "g" }],
  cleaning: [{ en: "Kitchen Surface Cleaner", ru: "Средство для кухни", emoji: "🧽", terms: ["cleaner", "cleaning", "уборка"], unit: "ml" }],
  personal: [{ en: "Gentle Hand Wash", ru: "Мягкое мыло для рук", emoji: "🧴", terms: ["soap", "hand wash", "мыло"], unit: "ml" }],
  pets: [{ en: "Chicken Cat Food", ru: "Корм для кошек с курицей", emoji: "🐈", terms: ["cat food", "pet food", "корм для кошек"], unit: "g" }],
  household: [{ en: "Recycled Kitchen Towels", ru: "Бумажные полотенца", emoji: "🧻", terms: ["paper towel", "kitchen towel", "бумажные полотенца"], unit: "piece" }],
};
