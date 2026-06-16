'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/lib/i18n'

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

interface PantrySnap {
  quantity: string | null
  unit: string | null
}

interface Props {
  meal: Meal
  onClose: () => void
  onCooked: () => void
}

export default function MarkCookedModal({ meal, onClose, onCooked }: Props) {
  const { profile } = useAuth()
  const t = useT()
  const [ingredients, setIngredients]   = useState<Ingredient[]>([])
  const [pantrySnaps, setPantrySnaps]   = useState<Record<string, PantrySnap>>({})
  const [checked, setChecked]           = useState<Set<string>>(new Set())
  const [deductAmounts, setDeductAmounts] = useState<Record<string, string>>({})
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('meal_ingredients')
        .select('*')
        .eq('meal_id', meal.id)
      const ings = (data ?? []) as Ingredient[]
      setIngredients(ings)

      // Load pantry quantities for all linked ingredients
      const linked = ings.filter(i => i.pantry_item_id)
      const snaps: Record<string, PantrySnap> = {}
      const amounts: Record<string, string> = {}

      for (const ing of linked) {
        const { data: p } = await supabase
          .from('pantry_items')
          .select('quantity, unit')
          .eq('id', ing.pantry_item_id!)
          .single()
        if (p) {
          snaps[ing.id] = p as PantrySnap
          // Pre-fill deduct amount only when units match
          if (p.unit === ing.unit && ing.quantity) {
            amounts[ing.id] = ing.quantity
          }
        }
      }

      setPantrySnaps(snaps)
      setDeductAmounts(amounts)
      setChecked(new Set(linked.map(i => i.id)))
      setLoading(false)
    }
    load()
  }, [meal.id])

  async function confirmCook() {
    setSaving(true)

    const toDeduct = ingredients.filter(i => checked.has(i.id) && i.pantry_item_id)

    for (const ing of toDeduct) {
      const snap = pantrySnaps[ing.id]
      if (!snap) continue

      const deductStr = deductAmounts[ing.id]?.trim()
      const deductQty = parseFloat(deductStr ?? 'NaN')
      const currentQty = parseFloat(snap.quantity ?? 'NaN')

      // Skip if no valid deduct amount entered
      if (isNaN(deductQty) || deductQty <= 0) continue

      if (!isNaN(currentQty)) {
        const remaining = Math.round((currentQty - deductQty) * 100) / 100
        if (remaining > 0) {
          await supabase
            .from('pantry_items')
            .update({ quantity: String(remaining) })
            .eq('id', ing.pantry_item_id!)
        } else {
          await supabase.from('pantry_items').delete().eq('id', ing.pantry_item_id!)
        }
      } else {
        // Pantry had no numeric quantity — just delete it
        await supabase.from('pantry_items').delete().eq('id', ing.pantry_item_id!)
      }
    }

    await supabase
      .from('meals')
      .update({ cooked_at: new Date().toISOString() })
      .eq('id', meal.id)

    void profile
    setSaving(false)
    onCooked()
  }

  const pantryLinked = ingredients.filter(i => i.pantry_item_id)
  const notLinked    = ingredients.filter(i => !i.pantry_item_id)
  const willDeduct   = pantryLinked.filter(i =>
    checked.has(i.id) && parseFloat(deductAmounts[i.id] ?? 'NaN') > 0
  ).length

  const btnLabel = saving
    ? t('saving')
    : willDeduct > 0
      ? t('cooked_btn_deduct').replace('{n}', String(willDeduct))
      : t('cooked_btn_plain')

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
            <h2 className="text-xl font-bold text-slate-800">{t('cooked_title')}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{meal.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">✕</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 text-sm animate-pulse">
              {t('loading')}
            </div>
          ) : (
            <>
              {pantryLinked.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('cooked_deduct')}</p>
                  <div className="space-y-1">
                    {pantryLinked.map(ing => {
                      const snap = pantrySnaps[ing.id]
                      const unitsMatch = snap?.unit === ing.unit
                      const hint = [ing.quantity, ing.unit].filter(Boolean).join(' ')
                      const pantryHint = snap ? `${t('cooked_pantry_has')} ${snap.quantity ?? '?'} ${snap.unit ?? ''}`.trim() : ''

                      return (
                        <div key={ing.id} className="rounded-xl border border-slate-100 px-3 py-2.5">
                          <div className="flex items-center gap-3">
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
                              <p className="text-xs text-slate-400">
                                {[hint ? `recipe: ${hint}` : null, pantryHint].filter(Boolean).join(' · ')}
                              </p>
                            </div>
                          </div>

                          {checked.has(ing.id) && (
                            <div className="mt-2 ml-7 flex items-center gap-2">
                              <input
                                type="number"
                                inputMode="decimal"
                                value={deductAmounts[ing.id] ?? ''}
                                onChange={e => setDeductAmounts(prev => ({ ...prev, [ing.id]: e.target.value }))}
                                placeholder={unitsMatch ? (ing.quantity ?? '0') : '0'}
                                className="w-24 px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-400"
                              />
                              <span className="text-sm text-slate-500">{snap?.unit ?? ing.unit ?? ''}</span>
                              {!unitsMatch && (
                                <span className="text-xs text-amber-500">⚠️ units differ</span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {notLinked.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('cooked_not_in_pantry')}</p>
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
                <p className="text-sm text-slate-400 py-8 text-center">{t('cooked_no_ingredients')}</p>
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
            {btnLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
