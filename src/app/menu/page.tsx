'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import AddMealModal from '@/components/AddMealModal'

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
  const today = new Date()
  const day   = today.getDay()
  const diff  = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff + offset * 7)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0]
}

function isToday(date: Date): boolean {
  return toDateStr(date) === toDateStr(new Date())
}

export default function MenuPage() {
  const [weekOffset, setWeekOffset]       = useState(0)
  const [meals, setMeals]                 = useState<Meal[]>([])
  const [addingForDate, setAddingForDate] = useState<string | null>(null)
  const [editMeal, setEditMeal]           = useState<Meal | null>(null)

  const fetchMeals = useCallback(async () => {
    const days = getWeekDays(weekOffset)
    const from = toDateStr(days[0])
    const to   = toDateStr(days[6])
    const { data } = await supabase
      .from('meals')
      .select('*')
      .gte('date', from)
      .lte('date', to)
    setMeals(data ?? [])
  }, [weekOffset])

  useEffect(() => { fetchMeals() }, [fetchMeals])

  async function deleteMeal(id: string) {
    await supabase.from('meals').delete().eq('id', id)
    setMeals(prev => prev.filter(m => m.id !== id))
  }

  const days      = getWeekDays(weekOffset)
  const weekLabel = weekOffset === 0 ? 'This Week' : 'Next Week'
  const weekRange = `${days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 px-4 pt-4 pb-4">

        {/* Header + week navigation */}
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

        {/* Day cards */}
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
                {/* Day header */}
                <div className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${today ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                    {today && (
                      <span className="text-xs bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-medium">Today</span>
                    )}
                  </div>
                  <button
                    onClick={() => setAddingForDate(dateStr)}
                    className="text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    + Add
                  </button>
                </div>

                {/* Meals */}
                {dayMeals.length > 0 ? (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {dayMeals.map(meal => (
                      <div key={meal.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-base flex-shrink-0">{SLOT_EMOJI[meal.slot]}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{meal.name}</p>
                          <p className="text-xs text-slate-400">
                            {meal.slot.charAt(0).toUpperCase() + meal.slot.slice(1)} · {meal.servings} serving{meal.servings !== 1 ? 's' : ''}
                          </p>
                        </div>
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
                    ))}
                  </div>
                ) : (
                  <div className="border-t border-slate-50 px-4 py-2">
                    <p className="text-xs text-slate-400 italic">No meals planned</p>
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
    </div>
  )
}
