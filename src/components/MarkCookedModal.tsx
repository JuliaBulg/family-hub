'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
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
  const t = useT()
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [pantrySnaps, setPantrySnaps] = useState<Record<string, PantrySnap>>({})
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

      const linked = ings.filter(i => i.pantry_item_id)
      const snaps: Record<string, PantrySnap> = {}
      for (const ing of linked) {
        const { data: p } = await supabase
          .from('pantry_items')
          .select('quantity, unit')
          .eq('id', ing.pantry_item_id!)
          .single()
        if (p) snaps[ing.id] = p as PantrySnap
      }
      setPantrySnaps(snaps)

      // Pre-check only ingredients we can auto-deduct
      const autoCheckable = linked.filter(ing => {
        const snap = snaps[ing.id]
        return snap && ing.unit && snap.unit && ing.unit === snap.unit
          && ing.quantity && parseFloat(ing.quantity) > 0
      })
      setChecked(new Set(autoCheckable.map(i => i.id)))
      setLoading(false)
    }
    load()
  }, [meal.id])

  function canDeduct(ing: Ingredient): boolean {
    const snap = pantrySnaps[ing.id]
    return !!snap && !!ing.unit && !!snap.unit && ing.unit === snap.unit
      && !!ing.quantity && parseFloat(ing.quantity) > 0
  }

  async function confirmCook() {
    setSaving(true)

    const toDeduct = ingredients.filter(i => checked.has(i.id) && i.pantry_item_id && canDeduct(i))

    for (const ing of toDeduct) {
      const snap = pantrySnaps[ing.id]
      if (!snap || !ing.quantity) continue

      const deductQty = parseFloat(ing.quantity)
      const currentQty = parseFloat(snap.quantity ?? 'NaN')

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
        await supabase.from('pantry_items').delete().eq('id', ing.pantry_item_id!)
      }
    }

    await supabase
      .from('meals')
      .update({ cooked_at: new Date().toISOString() })
      .eq('id', meal.id)

    setSaving(false)
    onCooked()
  }

  function toggleChecked(id: string) {
    setChecked(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const pantryLinked = ingredients.filter(i => i.pantry_item_id)
  const notLinked    = ingredients.filter(i => !i.pantry_item_id)
  const willDeduct   = pantryLinked.filter(i => checked.has(i.id) && canDeduct(i)).length

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
                      const deductable = canDeduct(ing)
                      const unitsMatch = snap && ing.unit && snap.unit && ing.unit === snap.unit
                      const hasQty = ing.quantity && parseFloat(ing.quantity) > 0
                      const recipeHint = [ing.quantity, ing.unit].filter(Boolean).join(' ')
                      const pantryHint = snap ? `${t('cooked_pantry_has')} ${snap.quantity ?? '?'} ${snap.unit ?? ''}`.trim() : ''

                      return (
                        <div
                          key={ing.id}
                          className={`rounded-xl border px-3 py-2.5 flex items-start gap-3 ${
                            deductable ? 'border-slate-100' : 'border-slate-50 opacity-50'
                          }`}
                        >
                          {deductable ? (
                            <input
                              type="checkbox"
                              checked={checked.has(ing.id)}
                              onChange={() => toggleChecked(ing.id)}
                              className="w-4 h-4 mt-0.5 accent-emerald-500 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-4 h-4 mt-0.5 rounded border border-slate-300 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700">{ing.name}</p>
                            <p className="text-xs text-slate-400">
                              {[recipeHint ? `${t('cooked_recipe')}: ${recipeHint}` : null, pantryHint].filter(Boolean).join(' · ')}
                            </p>
                            {!unitsMatch && snap && (
                              <p className="text-xs text-amber-500 mt-0.5">⚠️ {t('cooked_units_differ')}</p>
                            )}
                            {!hasQty && (
                              <p className="text-xs text-slate-400 mt-0.5">⚠️ {t('cooked_no_amount')}</p>
                            )}
                          </div>
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
                        <div>
                          <p className="text-sm text-slate-600">{ing.name}</p>
                          {(ing.quantity || ing.unit) && (
                            <p className="text-xs text-slate-400">{[ing.quantity, ing.unit].filter(Boolean).join(' ')}</p>
                          )}
                        </div>
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
