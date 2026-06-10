export interface RecipePreload {
  name: string
  ingredients: { name: string; quantity: string | null; unit: string | null; sort_order: number }[]
}

export const FAMILY_RECIPES_PRELOAD: RecipePreload[] = [
  {
    name: 'Pasta Bolognese',
    ingredients: [
      { name: 'pasta',              quantity: '400', unit: 'g',  sort_order: 0 },
      { name: 'minced meat',        quantity: '500', unit: 'g',  sort_order: 1 },
      { name: 'tomato pasta sauce', quantity: '1',   unit: 'jar', sort_order: 2 },
    ],
  },
  {
    name: 'Homemade Kotlet with Mashed Potato',
    ingredients: [
      { name: 'minced meat',        quantity: '500', unit: 'g',  sort_order: 0 },
      { name: 'onion',              quantity: '1',   unit: null, sort_order: 1 },
      { name: 'egg',                quantity: '1',   unit: null, sort_order: 2 },
      { name: 'breadcrumbs',        quantity: '50',  unit: 'g',  sort_order: 3 },
      { name: 'potatoes',           quantity: '2',   unit: 'kg', sort_order: 4 },
      { name: 'lactose-free milk',  quantity: '1',   unit: 'L',  sort_order: 5 },
    ],
  },
  {
    name: 'Chicken Liver in Sour Cream',
    ingredients: [
      { name: 'chicken liver',  quantity: '500', unit: 'g', sort_order: 0 },
      { name: 'onion',          quantity: '2',   unit: null, sort_order: 1 },
      { name: 'sour cream',     quantity: '250', unit: 'g', sort_order: 2 },
      { name: 'buckwheat',      quantity: '400', unit: 'g', sort_order: 3 },
    ],
  },
  {
    name: 'Chicken Thighs in Sour Cream',
    ingredients: [
      { name: 'boneless chicken thighs', quantity: '500', unit: 'g', sort_order: 0 },
      { name: 'sour cream',              quantity: '250', unit: 'g', sort_order: 1 },
      { name: 'buckwheat',               quantity: '400', unit: 'g', sort_order: 2 },
    ],
  },
  {
    name: 'Caesar Salad',
    ingredients: [
      { name: 'chicken breast',   quantity: '500', unit: 'g',  sort_order: 0 },
      { name: 'salad leaves',     quantity: '100', unit: 'g',  sort_order: 1 },
      { name: 'cherry tomatoes',  quantity: '250', unit: 'g',  sort_order: 2 },
      { name: 'cucumbers',        quantity: '3',   unit: null, sort_order: 3 },
      { name: 'Caesar dressing',  quantity: '150', unit: 'g',  sort_order: 4 },
    ],
  },
  {
    name: 'Chicken Soup',
    ingredients: [
      { name: 'chicken wings', quantity: '500', unit: 'g',  sort_order: 0 },
      { name: 'potatoes',      quantity: '8',   unit: null, sort_order: 1 },
      { name: 'carrot',        quantity: '1',   unit: null, sort_order: 2 },
      { name: 'onion',         quantity: '1',   unit: null, sort_order: 3 },
      { name: 'noodles',       quantity: '150', unit: 'g',  sort_order: 4 },
    ],
  },
  {
    name: 'Beef Stroganoff',
    ingredients: [
      { name: 'beef sirloin',  quantity: '800', unit: 'g',  sort_order: 0 },
      { name: 'onion',         quantity: '3',   unit: null, sort_order: 1 },
      { name: 'sour cream',    quantity: '200', unit: 'ml', sort_order: 2 },
      { name: 'tomato paste',  quantity: '50',  unit: 'g',  sort_order: 3 },
      { name: 'potatoes',      quantity: '2',   unit: 'kg', sort_order: 4 },
    ],
  },
  {
    name: 'Meatball Soup',
    ingredients: [
      { name: 'minced meat',  quantity: '400', unit: 'g',  sort_order: 0 },
      { name: 'potatoes',     quantity: '8',   unit: null, sort_order: 1 },
      { name: 'carrot',       quantity: '1',   unit: null, sort_order: 2 },
      { name: 'onion',        quantity: '1',   unit: null, sort_order: 3 },
    ],
  },
  {
    name: 'Meatballs with Rice',
    ingredients: [
      { name: 'minced meat',  quantity: '400', unit: 'g',  sort_order: 0 },
      { name: 'rice',         quantity: '150', unit: 'g',  sort_order: 1 },
      { name: 'sour cream',   quantity: '400', unit: 'g',  sort_order: 2 },
      { name: 'onion',        quantity: '1',   unit: null, sort_order: 3 },
    ],
  },
  {
    name: 'Salmon with Blue Cheese Sauce',
    ingredients: [
      { name: 'salmon',      quantity: '700', unit: 'g', sort_order: 0 },
      { name: 'sour cream',  quantity: '250', unit: 'g', sort_order: 1 },
      { name: 'blue cheese', quantity: '150', unit: 'g', sort_order: 2 },
      { name: 'rice',        quantity: '400', unit: 'g', sort_order: 3 },
    ],
  },
  {
    name: 'Borscht',
    ingredients: [
      { name: 'beef on the bone', quantity: null,  unit: null, sort_order: 0 },
      { name: 'potatoes',         quantity: '8',   unit: null, sort_order: 1 },
      { name: 'carrots',          quantity: '2',   unit: null, sort_order: 2 },
      { name: 'onion',            quantity: '1',   unit: null, sort_order: 3 },
      { name: 'beetroot',         quantity: '600', unit: 'g',  sort_order: 4 },
      { name: 'sauerkraut',       quantity: '150', unit: 'g',  sort_order: 5 },
      { name: 'tomato paste',     quantity: '50',  unit: 'g',  sort_order: 6 },
    ],
  },
]
