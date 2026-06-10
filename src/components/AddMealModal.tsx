'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type Slot = 'breakfast' | 'lunch' | 'dinner'

interface Meal {
  id: string
  date: string
  slot: Slot
  name: string
  servings: number
}

interface Ingredient {
  name: string
  quantity: string | null
  unit: string | null
  pantry_item_id: string | null
}

interface Props {
  date: string
  meal?: Meal
  onClose: () => void
  onSaved: () => void
}

const SLOTS: { value: Slot; label: string; emoji: string }[] = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { value: 'lunch',     label: 'Lunch',     emoji: '☀️'  },
  { value: 'dinner',    label: 'Dinner',    emoji: '🌙' },
]

export default function AddMealModal({ date, meal, onClose, onSaved }: Props) {
  const { profile } = useAuth()
  const [mealDate, setMealDate] = useState(meal?.date ?? date)
  const [slot, setSlot]         = useState<Slot>(meal?.slot ?? 'dinner')
  const [name, setName]         = useState(meal?.name ?? '')
  const [servings, setServings] = useState(meal?.servings ?? 2)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const [step, setStep]                  = useState<1 | 2>(1)
  const [ingredients, setIngredients]    = useState<Ingredient[]>([])
  const [savedMealName, setSavedMealName] = useState('')
  const [addingToShop, setAddingToShop]  = useState(false)
  const [shopAdded, setShopAdded]        = useState(false)

  const [showRecipePicker, setShowRecipePicker] = useState(false)
  const [recipeList, setRecipeList]             = useState<{ id: string; name: string }[]>([])
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [loadingRecipes, setLoadingRecipes]     = useState(false)

  async function openRecipePicker() {
    setShowRecipePicker(true)
    if (recipeList.length > 0) return
    setLoadingRecipes(true)
    const { data } = await supabase.from('recipes').select('id, name').order('name')
    setRecipeList(data ?? [])
    setLoadingRecipes(false)
  }

  function pickRecipe(id: string, recipeName: string) {
    setSelectedRecipeId(id)
    setName(recipeName)
    setShowRecipePicker(false)
  }

  function clearRecipe() {
    setSelectedRecipeId(null)
    setName('')
  }

  async function handleSubmit() {
    if (!name.trim()) return
    setLoading(true)
    setError('')

    const payload = { date: mealDate, slot, name: name.trim(), servings }

    if (meal) {
      const { error: dbErr } = await supabase.from('meals').update(payload).eq('id', meal.id)
      setLoading(false)
      if (dbErr) { setError('Something went wrong. Please try again.'); return }
      onSaved()
      return
    }

    const { data: newMeal, error: dbErr } = await supabase
      .from('meals')
      .insert({ ...payload, household_id: profile?.household_id, added_by: profile?.display_name })
      .select('id')
      .single()

    if (dbErr || !newMeal) {
      setLoading(false)
      setError('Something went wrong. Please try again.')
      return
    }

    const { data: pantryItems } = await supabase.from('pantry_items').select('id, name')

    if (selectedRecipeId) {
      const { data: recipeIngs } = await supabase
        .from('recipe_ingredients')
        .select('name, quantity, unit')
        .eq('recipe_id', selectedRecipeId)
        .order('sort_order')

      const ings: Ingredient[] = (recipeIngs ?? []).map(ing => {
        const lower = ing.name.toLowerCase()
        const match = (pantryItems ?? []).find(p =>
          p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase())
        )
        return { name: ing.name, quantity: ing.quantity, unit: ing.unit, pantry_item_id: match?.id ?? null }
      })

      if (ings.length > 0) {
        await supabase.from('meal_ingredients').insert(
          ings.map(ing => ({
            meal_id: newMeal.id,
            household_id: profile?.household_id,
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            pantry_item_id: ing.pantry_item_id,
          }))
        )
        setIngredients(ings)
      }
      setSavedMealName(name.trim())
      setLoading(false)
      setStep(2)
    } else {
      try {
        const res = await fetch('/api/meal-ingredients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mealName: name.trim(), servings, pantryItems: pantryItems ?? [], language: profile?.language ?? 'en' }),
        })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error()

        const ings: Ingredient[] = json.ingredients ?? []
        if (ings.length > 0) {
          await supabase.from('meal_ingredients').insert(
            ings.map(ing => ({
              meal_id: newMeal.id,
              household_id: profile?.household_id,
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit,
              pantry_item_id: ing.pantry_item_id,
            }))
          )
          setIngredients(ings)
        }
        setSavedMealName(name.trim())
        setLoading(false)
        setStep(2)
      } catch {
        setLoading(false)
        onSaved()
      }
    }
  }

  async function addMissingToShopping() {
    const missing = ingredients.filter(i => !i.pantry_item_id)
    if (missing.length === 0) return
    setAddingToShop(true)
    await supabase.from('shopping_items').insert(
      missing.map(ing => ({
        name: ing.name,
        quantity: ing.quantity ? `${ing.quantity}${ing.unit ? ' ' + ing.unit : ''}` : null,
        is_ticked: false,
        household_id: profile?.household_id,
        added_by: profile?.display_name,
      }))
    )
    setAddingToShop(false)
    setShopAdded(true)
  }

  if (step === 2) {
    const have    = ingredients.filter(i => i.pantry_item_id)
    const missing = ingredients.filter(i => !i.pantry_item_id)
    return (
      <div className="fixed inset-0 bg-black/40 z-[200] flex items-start justify-center">
        <div
          className="bg-white w-full max-w-md rounded-b-3xl flex flex-col"
          style={{ maxHeight: '90dvh' }}
        >
          <div className="flex-shrink-0 px-6 pt-8 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">🧑‍🍳 Ingredients</h2>
              <p className="text-xs text-slate-400 mt-0.5">{savedMealName} · {servings} {servings === 1 ? 'person' : 'people'}</p>
            </div>
            <button onClick={onSaved} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-4 pt-2 space-y-1">
            {have.map(ing => (
              <div key={ing.name} className="flex items-center gap-3 py-2.5 border-b border-slate-50">
                <span className="text-emerald-500 font-bold text-sm w-4">✓</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">{ing.name}</p>
                  {(ing.quantity || ing.unit) && (
                    <p className="text-xs text-slate-400">{[ing.quantity, ing.unit].filter(Boolean).join(' ')}</p>
                  )}
                </div>
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex-shrink-0">In pantry</span>
              </div>
            ))}
            {missing.map(ing => (
              <div key={ing.name} className="flex items-center gap-3 py-2.5 border-b border-slate-50">
                <span className="text-red-400 font-bold text-sm w-4">−</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">{ing.name}</p>
                  {(ing.quantity || ing.unit) && (
                    <p className="text-xs text-slate-400">{[ing.quantity, ing.unit].filter(Boolean).join(' ')}</p>
                  )}
                </div>
                <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full flex-shrink-0">Missing</span>
              </div>
            ))}
            {ingredients.length === 0 && (
              <p className="text-sm text-slate-400 py-8 text-center">No ingredients found</p>
            )}
          </div>

          <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 space-y-2">
            {missing.length > 0 && !shopAdded && (
              <button
                onClick={addMissingToShopping}
                disabled={addingToShop}
                className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white font-semibold rounded-2xl text-sm transition-colors"
              >
                {addingToShop ? 'Adding…' : `🛒 Add ${missing.length} missing to shopping list`}
              </button>
            )}
            {shopAdded && (
              <p className="text-center text-sm text-emerald-600 font-medium py-1">✓ Added to shopping list</p>
            )}
            <button
              onClick={onSaved}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-2xl text-sm transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[200] flex items-start justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-b-3xl flex flex-col"
        style={{ maxHeight: '90dvh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-6 pt-8 pb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">{meal ? 'Edit Meal' : 'Add Meal'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 space-y-5 pb-4">
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Date</label>
            <input
              type="date"
              value={mealDate}
              onChange={e => setMealDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600 mb-2 block">Meal slot</label>
            <div className="grid grid-cols-3 gap-2">
              {SLOTS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setSlot(s.value)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                    slot === s.value
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <span className="text-xl">{s.emoji}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-600">Meal name</label>
              {!meal && (
                <button
                  onClick={openRecipePicker}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                >
                  📖 Pick from recipes
                </button>
              )}
            </div>

            {selectedRecipeId ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-emerald-300 bg-emerald-50">
                <span className="text-sm font-medium text-emerald-800 flex-1 truncate">{name}</span>
                <button onClick={clearRecipe} className="text-emerald-500 hover:text-emerald-700 text-sm">✕</button>
              </div>
            ) : (
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Pasta Bolognese, Chicken soup…"
                autoFocus={!meal}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            )}

            {showRecipePicker && !selectedRecipeId && (
              <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                {loadingRecipes ? (
                  <p className="text-sm text-slate-400 px-4 py-3 animate-pulse">Loading…</p>
                ) : recipeList.length === 0 ? (
                  <p className="text-sm text-slate-400 px-4 py-3">No recipes saved yet</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
                    {recipeList.map(r => (
                      <button
                        key={r.id}
                        onClick={() => pickRecipe(r.id, r.name)}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600 mb-2 block">Servings</label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setServings(s => Math.max(1, s - 1))}
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xl font-semibold transition-colors"
              >
                −
              </button>
              <span className="text-2xl font-bold text-slate-800 w-8 text-center">{servings}</span>
              <button
                onClick={() => setServings(s => Math.min(12, s + 1))}
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xl font-semibold transition-colors"
              >
                +
              </button>
              <span className="text-sm text-slate-400">people</span>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100">
          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-semibold rounded-2xl text-base transition-colors"
          >
            {loading ? 'Saving & analysing…' : meal ? '✅ Save Changes' : '✅ Add Meal'}
          </button>
        </div>
      </div>
    </div>
  )
}
