'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import AddMealModal from '@/components/AddMealModal'
import MarkCookedModal from '@/components/MarkCookedModal'
import { useT } from '@/lib/i18n'
import { addToShoppingMerged } from '@/lib/shopping'

type Slot = 'breakfast' | 'lunch' | 'dinner'

interface Meal {
  id: string
  date: string
  slot: Slot
  name: string
  servings: number
  cooked_at: string | null
  added_by: string | null
}

const SLOT_ORDER: Record<Slot, number> = { breakfast: 0, lunch: 1, dinner: 2 }
const SLOT_EMOJI: Record<Slot, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' }

function getWeekDays(offset: number): Date[] {
  const today   = new Date()
  const day     = today.getDay()
  const diff    = day === 0 ? -6 : 1 - day
  const monday  = new Date(today)
  monday.setDate(today.getDate() + diff + offset * 7)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isToday(date: Date): boolean {
  return toDateStr(date) === toDateStr(new Date())
}

export default function MenuPage() {
  const { profile } = useAuth()
  const t = useT()
  const [weekOffset, setWeekOffset]       = useState(0)
  const [meals, setMeals]                 = useState<Meal[]>([])
  const [addingForDate, setAddingForDate] = useState<string | null>(null)
  const [editMeal, setEditMeal]           = useState<Meal | null>(null)
  const [cookMeal, setCookMeal]           = useState<Meal | null>(null)
  const [addingMissing, setAddingMissing] = useState<string | null>(null)
  const [expandedMealId, setExpandedMealId]     = useState<string | null>(null)
  const [mealIngredients, setMealIngredients]   = useState<Record<string, { name: string; quantity: string | null; unit: string | null; pantry_item_id: string | null }[]>>({})
  const [loadingIngredients, setLoadingIngredients] = useState<string | null>(null)

  function slotLabel(slot: Slot) {
    if (slot === 'breakfast') return t('slot_breakfast')
    if (slot === 'lunch') return t('slot_lunch')
    return t('slot_dinner')
  }

  const fetchMeals = useCallback(async () => {
    if (!profile?.household_id) return
    const days = getWeekDays(weekOffset)
    const from = toDateStr(days[0])
    const to   = toDateStr(days[6])
    const { data } = await supabase
      .from('meals')
      .select('*')
      .eq('household_id', profile.household_id)
      .gte('date', from)
      .lte('date', to)
    setMeals(data ?? [])
  }, [weekOffset, profile?.household_id])

  useEffect(() => { fetchMeals() }, [fetchMeals])

  async function toggleIngredients(mealId: string) {
    if (expandedMealId === mealId) { setExpandedMealId(null); return }
    setExpandedMealId(mealId)
    if (!mealIngredients[mealId]) {
      setLoadingIngredients(mealId)
      const { data } = await supabase
        .from('meal_ingredients')
        .select('name, quantity, unit, pantry_item_id')
        .eq('meal_id', mealId)
      setMealIngredients(prev => ({ ...prev, [mealId]: data ?? [] }))
      setLoadingIngredients(null)
    }
  }

  async function deleteMeal(id: string) {
    await supabase.from('meals').delete().eq('id', id)
    setMeals(prev => prev.filter(m => m.id !== id))
  }

  async function addMissingToShopping(meal: Meal) {
    if (!profile?.household_id) return
    setAddingMissing(meal.id)

    const { data: ings } = await supabase
      .from('meal_ingredients')
      .select('name, quantity, unit, pantry_item_id')
      .eq('meal_id', meal.id)

    const missing = (ings ?? []).filter(i => !i.pantry_item_id)

    if (missing.length > 0) {
      await addToShoppingMerged(
        missing.map(ing => ({
          name: ing.name,
          amount_per_pack: ing.quantity ? parseFloat(ing.quantity) || null : null,
          unit: ing.unit ?? null,
        })),
        profile.household_id,
        profile?.display_name ?? null,
      )
    }

    setAddingMissing(null)
  }

  const days      = getWeekDays(weekOffset)
  const weekLabel = weekOffset === 0 ? t('menu_this_week') : t('menu_next_week')
  const weekRange = `${days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 px-4 pt-4 pb-4">

        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => { setWeekOffset(0); setMeals([]) }}
            disabled={weekOffset === 0}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 text-lg hover:bg-slate-200 disabled:opacity-30 transition-colors"
          >
            ‹
          </button>
          <div className="text-center">
            <h1 className="text-base font-semibold text-slate-800">{weekLabel}</h1>
            <p className="text-xs text-slate-400">{weekRange}</p>
          </div>
          <button
            onClick={() => { setWeekOffset(1); setMeals([]) }}
            disabled={weekOffset === 1}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 text-lg hover:bg-slate-200 disabled:opacity-30 transition-colors"
          >
            ›
          </button>
        </div>

        <div className="space-y-2">
          {days.map(day => {
            const dateStr  = toDateStr(day)
            const today    = isToday(day)
            const dayMeals = meals
              .filter(m => m.date === dateStr)
              .sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot])

            return (
              <div
                key={dateStr}
                className={`rounded-2xl border overflow-hidden ${
                  today ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-100 bg-white'
                }`}
              >
                <div className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${today ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                    {today && (
                      <span className="text-xs bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-medium">{t('today_label')}</span>
                    )}
                  </div>
                  <button
                    onClick={() => setAddingForDate(dateStr)}
                    className="text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    {t('menu_add_btn')}
                  </button>
                </div>

                {dayMeals.length > 0 ? (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {dayMeals.map(meal => {
                      const isExpanded = expandedMealId === meal.id
                      const ings = mealIngredients[meal.id] ?? []
                      return (
                        <div key={meal.id} className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleIngredients(meal.id)}
                              className="flex items-center gap-3 flex-1 min-w-0 text-left"
                            >
                              <span className="text-base flex-shrink-0">{SLOT_EMOJI[meal.slot]}</span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${meal.cooked_at ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                  {meal.name}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {slotLabel(meal.slot)} · {meal.servings} {meal.servings === 1 ? t('serving_label') : t('servings_label')}
                                  {meal.cooked_at && t('menu_cooked_badge')}
                                </p>
                              </div>
                              <span className="text-slate-300 text-xs flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>
                            </button>
                            <button
                              onClick={() => setEditMeal(meal)}
                              className="text-slate-300 hover:text-slate-500 text-sm transition-colors px-1"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => deleteMeal(meal.id)}
                              className="text-slate-300 hover:text-red-400 text-lg transition-colors"
                            >
                              ✕
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="mt-2 ml-8 mb-1">
                              {loadingIngredients === meal.id ? (
                                <p className="text-xs text-slate-400 animate-pulse">{t('loading')}</p>
                              ) : ings.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">{t('menu_no_ingredients')}</p>
                              ) : (
                                <div className="space-y-1">
                                  {ings.map(ing => (
                                    <div key={ing.name} className="flex items-center gap-2">
                                      <span className={`text-xs flex-shrink-0 ${ing.pantry_item_id ? 'text-emerald-500' : 'text-slate-300'}`}>
                                        {ing.pantry_item_id ? '✓' : '·'}
                                      </span>
                                      <p className="text-xs text-slate-600 flex-1">{ing.name}</p>
                                      {(ing.quantity || ing.unit) && (
                                        <p className="text-xs text-slate-400 flex-shrink-0">{[ing.quantity, ing.unit].filter(Boolean).join(' ')}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {!meal.cooked_at && (
                            <div className="flex gap-2 mt-2 ml-8">
                              <button
                                onClick={() => addMissingToShopping(meal)}
                                disabled={addingMissing === meal.id}
                                className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 px-2.5 py-1 rounded-lg transition-colors"
                              >
                                {addingMissing === meal.id ? '…' : t('menu_add_missing')}
                              </button>
                              <button
                                onClick={() => setCookMeal(meal)}
                                className="text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors"
                              >
                                {t('menu_cooked_btn')}
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="border-t border-slate-50 px-4 py-2">
                    <p className="text-xs text-slate-400 italic">{t('menu_no_meals')}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {(addingForDate !== null || editMeal !== null) && (
        <AddMealModal
          date={addingForDate ?? editMeal!.date}
          meal={editMeal ?? undefined}
          onClose={() => { setAddingForDate(null); setEditMeal(null) }}
          onSaved={() => { setAddingForDate(null); setEditMeal(null); void fetchMeals() }}
        />
      )}

      {cookMeal && (
        <MarkCookedModal
          meal={cookMeal}
          onClose={() => setCookMeal(null)}
          onCooked={() => { setCookMeal(null); void fetchMeals() }}
        />
      )}
    </div>
  )
}
