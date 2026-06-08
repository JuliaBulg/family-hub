export type Category = 'food' | 'drinks' | 'household' | 'personal' | 'medicine' | 'pets' | 'other'

export const CATEGORIES = [
  { value: 'food'      as Category, label: 'Food & Groceries',     emoji: '🛒', color: 'bg-green-50  border-green-200'  },
  { value: 'drinks'    as Category, label: 'Drinks & Extras',      emoji: '🥤', color: 'bg-purple-50 border-purple-200' },
  { value: 'household' as Category, label: 'Household',            emoji: '🧹', color: 'bg-blue-50   border-blue-200'   },
  { value: 'personal'  as Category, label: 'Personal & Cosmetics', emoji: '🧴', color: 'bg-slate-50  border-slate-200'  },
  { value: 'medicine'  as Category, label: 'Medicine & First Aid', emoji: '💊', color: 'bg-pink-50   border-pink-200'   },
  { value: 'pets'      as Category, label: 'Pets & Animals',       emoji: '🐾', color: 'bg-amber-50  border-amber-200'  },
  { value: 'other'     as Category, label: 'Everything Else',      emoji: '🧺', color: 'bg-orange-50 border-orange-200' },
]
