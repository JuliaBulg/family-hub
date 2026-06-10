'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface Meal {
  id: string
  name: string
  servings: number
}

interface Ingredient {
  id: string
  name: string
  quantity: string | null
  unit: string | null
  pantry_item_id: string | null
}

interface Props {
  meal: Meal
  onClose: () => void
  onCooked: () => void
}

export default function MarkCookedModal({ meal, onClose, onCooked }: Props) {
  const { profile } = useAuth()
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [checked, setChecked]         = useState<Set<string>>(new Set())
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('meal_ingredients')
        .select('*')
        .eq('meal_id', meal.id)
      const ings = (data ?? []) as Ingredient[]
      setIngredients(ings)
      setChecked(new Set(ings.filter(i => i.pantry_item_id).map(i => i.id)))
      setLoading(false)
    }
    load()
  }, [meal.id])

  async function confirmCook() {
    setSaving(true)

    const toDeduct = ingredients.filter(i => checked.has(i.id) && i.pantry_item_id)

    for (const ing of toDeduct) {
      const { data: pantryItem } = await supabase
        .from('pantry_items')
        .select('id, quantity, unit')
        .eq('id', ing.pantry_item_id!)
        .single()

      if (!pantryItem) continue

      const currentQty = parseFloat(pantryItem.quantity ?? 'NaN')
      const deductQty  = parseFloat(ing.quantity ?? 'NaN')

      if (!isNaN(currentQty) && !isNaN(deductQty) && currentQty > deductQty) {
        await supabase
          .from('pantry_items')
          .update({ quantity: String(Math.round((currentQty - deductQty) * 100) / 100) })
          .eq('id', pantryItem.id)
      } else {
        await supabase.from('pantry_items').delete().eq('id', pantryItem.id)
      }
    }

    await supabase
      .from('meals')
      .update({ cooked_at: new Date().toISOString() })
      .eq('id', meal.id)

    // Update household context so pantry refreshes
    void profile

    setSaving(false)
    onCooked()
  }

  const pantryLinked = ingredients.filter(i => i.pantry_item_id)
  const notLinked    = ingredients.filter(i => !i.pantry_item_id)

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
            <h2 className="text-xl font-bold text-slate-800">✅ Mark as Cooked</h2>
            <p className="text-xs text-slate-400 mt-0.5">{meal.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">✕</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 text-sm animate-pulse">
              Loading ingredients…
            </div>
          ) : (
            <>
              {pantryLinked.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Deduct from pantry</p>
                  <div className="space-y-0.5">
                    {pantryLinked.map(ing => (
                      <label key={ing.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked.has(ing.id)}
                          onChange={() => setChecked(prev => {
                            const s = new Set(prev)
                            s.has(ing.id) ? s.delete(ing.id) : s.add(ing.id)
                            return s
                          })}
                          className="w-4 h-4 accent-emerald-500 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700">{ing.name}</p>
                          {(ing.quantity || ing.unit) && (
                            <p className="text-xs text-slate-400">{[ing.quantity, ing.unit].filter(Boolean).join(' ')}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {notLinked.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Not in pantry</p>
                  <div className="space-y-0.5">
                    {notLinked.map(ing => (
                      <div key={ing.id} className="flex items-center gap-3 py-2.5 px-3 opacity-40">
                        <div className="w-4 h-4 rounded border border-slate-300 flex-shrink-0" />
                        <p className="text-sm text-slate-600">{ing.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ingredients.length === 0 && (
                <p className="text-sm text-slate-400 py-8 text-center">No ingredients recorded for this meal</p>
              )}
            </>
          )}
        </div>

        <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100">
          <button
            onClick={confirmCook}
            disabled={saving || loading}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-semibold rounded-2xl text-base transition-colors"
          >
            {saving
              ? 'Saving…'
              : checked.size > 0
                ? `✅ Cooked — deduct ${checked.size} item${checked.size !== 1 ? 's' : ''} from pantry`
                : '✅ Mark as cooked'}
          </button>
        </div>
      </div>
    </div>
  )
}
