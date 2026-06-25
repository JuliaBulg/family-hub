export type Category =
  // Top-level (used by expenses, shopping)
  'food' | 'drinks' | 'household' | 'personal' | 'medicine' | 'pets' | 'other' |
  // Food sub-categories (used by pantry + receipt parser)
  'food_veg' | 'food_dairy' | 'food_meat' | 'food_dry' |
  'food_frozen' | 'food_bread' | 'food_snacks' | 'food_drinks' | 'food_other'

// Used by expenses + shopping list category pickers (keep drinks/other for backward compat)
export const CATEGORIES = [
  { value: 'food'      as Category, label: 'Food & Groceries', emoji: '🛒', color: 'bg-green-50  border-green-200'  },
  { value: 'household' as Category, label: 'Household',        emoji: '🧹', color: 'bg-blue-50   border-blue-200'   },
  { value: 'personal'  as Category, label: 'Care & Beauty',    emoji: '🧴', color: 'bg-slate-50  border-slate-200'  },
  { value: 'medicine'  as Category, label: 'Medicine',         emoji: '💊', color: 'bg-pink-50   border-pink-200'   },
  { value: 'pets'      as Category, label: 'Pets',             emoji: '🐾', color: 'bg-amber-50  border-amber-200'  },
  { value: 'drinks'    as Category, label: 'Drinks & Extras',  emoji: '🥤', color: 'bg-purple-50 border-purple-200' },
  { value: 'other'     as Category, label: 'Everything Else',  emoji: '🧺', color: 'bg-orange-50 border-orange-200' },
]

// Food sub-categories — used by pantry display and add-pantry modal
export const FOOD_SUBCATEGORIES = [
  { value: 'food_veg'    as Category, emoji: '🥦', color: 'bg-green-50  border-green-100'  },
  { value: 'food_dairy'  as Category, emoji: '🥛', color: 'bg-yellow-50 border-yellow-100' },
  { value: 'food_meat'   as Category, emoji: '🍖', color: 'bg-red-50    border-red-100'    },
  { value: 'food_dry'    as Category, emoji: '🥫', color: 'bg-amber-50  border-amber-100'  },
  { value: 'food_frozen' as Category, emoji: '🧊', color: 'bg-cyan-50   border-cyan-100'   },
  { value: 'food_bread'  as Category, emoji: '🍞', color: 'bg-orange-50 border-orange-100' },
  { value: 'food_snacks' as Category, emoji: '🍬', color: 'bg-pink-50   border-pink-100'   },
  { value: 'food_drinks' as Category, emoji: '🥤', color: 'bg-blue-50   border-blue-100'   },
  { value: 'food_other'  as Category, emoji: '🍽️', color: 'bg-slate-50  border-slate-100'  },
]

// Top-level pantry categories (food is the umbrella; drinks/other fold into food)
export const PANTRY_TOP_CATS = [
  { value: 'food'      as Category, emoji: '🛒', color: 'bg-green-50  border-green-200'  },
  { value: 'household' as Category, emoji: '🧹', color: 'bg-blue-50   border-blue-200'   },
  { value: 'personal'  as Category, emoji: '🧴', color: 'bg-slate-50  border-slate-200'  },
  { value: 'medicine'  as Category, emoji: '💊', color: 'bg-pink-50   border-pink-200'   },
  { value: 'pets'      as Category, emoji: '🐾', color: 'bg-amber-50  border-amber-200'  },
]

/** True for any food-family value (generic + sub-categories + legacy drinks/other) */
export function isFoodFamily(cat: Category): boolean {
  return cat === 'food' || cat === 'drinks' || cat === 'other' || (cat as string).startsWith('food_')
}

/** Returns the FOOD_SUBCATEGORIES entry that a legacy or sub-category value maps to */
export function foodSubcatOf(cat: Category) {
  if (cat === 'drinks') return FOOD_SUBCATEGORIES.find(s => s.value === 'food_drinks')!
  if (cat === 'food' || cat === 'other') return FOOD_SUBCATEGORIES.find(s => s.value === 'food_other')!
  return FOOD_SUBCATEGORIES.find(s => s.value === cat) ?? FOOD_SUBCATEGORIES.find(s => s.value === 'food_other')!
}
