'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/lib/i18n'

type Slot = 'breakfast' | 'lunch' | 'dinner'

interface Props {
  meal: {
    id?: string          // recipe id — if present, loads recipe_ingredients
    name: string
    keyIngredients?: string[]  // from Cook Tonight suggestions (no quantities)
  }
  onClose: () => void
  onPlanned: () => void
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function PlanRecipeModal({ meal, onClose, onPlanned }: Props) {
  const { profile } = useAuth()
  const t = useT()
  const [date, setDate]         = useState(todayStr())
  const [slot, setSlot]         = useState<Slot>('dinner')
  const [servings, setServings] = useState(4)
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)

  const SLOTS = [
    { value: 'breakfast' as Slot, label: t('slot_breakfast'), emoji: '🌅' },
    { value: 'lunch'     as Slot, label: t('slot_lunch'),     emoji: '☀️'  },
    { value: 'dinner'    as Slot, label: t('slot_dinner'),    emoji: '🌙' },
  ]

  async function handlePlan() {
    setLoading(true)

    const { data: newMeal, error: mealErr } = await supabase
      .from('meals')
      .insert({
        household_id: profile?.household_id,
        date,
        slot,
        name: meal.name,
        servings,
        added_by: profile?.display_name,
      })
      .select('id')
      .single()

    if (mealErr || !newMeal) { setLoading(false); return }

    const { data: pantryItems } = await supabase.from('pantry_items').select('id, name')

    if (meal.id) {
      const { data: recipeIngs } = await supabase
        .from('recipe_ingredients')
        .select('name, quantity, unit')
        .eq('recipe_id', meal.id)
        .order('sort_order')

      if (recipeIngs && recipeIngs.length > 0) {
        await supabase.from('meal_ingredients').insert(
          recipeIngs.map(ing => {
            const lower = ing.name.toLowerCase()
            const match = (pantryItems ?? []).find(p =>
              p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase())
            )
            return {
              meal_id: newMeal.id,
              household_id: profile?.household_id,
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit,
              pantry_item_id: match?.id ?? null,
            }
          })
        )
      }
    } else if (meal.keyIngredients && meal.keyIngredients.length > 0) {
      await supabase.from('meal_ingredients').insert(
        meal.keyIngredients.map(name => {
          const lower = name.toLowerCase()
          const match = (pantryItems ?? []).find(p =>
            p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase())
          )
          return {
            meal_id: newMeal.id,
            household_id: profile?.household_id,
            name,
            quantity: null,
            unit: null,
            pantry_item_id: match?.id ?? null,
          }
        })
      )
    }

    setLoading(false)
    setDone(true)
    setTimeout(onPlanned, 800)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[200] flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-t-3xl flex flex-col"
        style={{ maxHeight: '85dvh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-shrink-0 pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        <div className="flex-shrink-0 px-6 pt-2 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{t('plan_title')}</h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[220px]">{meal.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">✕</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">{t('plan_date')}</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600 mb-2 block">{t('plan_slot')}</label>
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
            <label className="text-sm font-medium text-slate-600 mb-2 block">{t('plan_servings')}</label>
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
              <span className="text-sm text-slate-400">{t('people')}</span>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100">
          <button
            onClick={handlePlan}
            disabled={loading || done}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-semibold rounded-2xl text-base transition-colors"
          >
            {done ? t('plan_done') : loading ? t('plan_saving') : t('plan_btn')}
          </button>
        </div>
      </div>
    </div>
  )
}
