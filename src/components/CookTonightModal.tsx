'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import PlanRecipeModal from '@/components/PlanRecipeModal'

interface PantryItem {
  name: string
  quantity: string | null
  unit: string | null
}

interface Suggestion {
  name: string
  emoji: string
  description: string
  key_ingredients: string[]
  missing: string[]
  time_minutes: number
}

interface Props {
  items: PantryItem[]
  onClose: () => void
}

export default function CookTonightModal({ items, onClose }: Props) {
  const { profile } = useAuth()
  const [servings, setServings]       = useState(4)
  const [maxMinutes, setMaxMinutes]   = useState<number | null>(45)
  const [vegetarian, setVegetarian]   = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [done, setDone]               = useState(false)

  const [saved, setSaved]                   = useState<Set<number>>(new Set())
  const [saving, setSaving]                 = useState<number | null>(null)
  const [addedToShop, setAddedToShop]       = useState<Set<number>>(new Set())
  const [addingToShop, setAddingToShop]     = useState<number | null>(null)
  const [planSuggestion, setPlanSuggestion] = useState<Suggestion | null>(null)

  const TIME_PRESETS = [
    { label: '⚡ Quick',   sub: '≤ 25 min',  minutes: 25  },
    { label: '🕐 Normal',  sub: '≤ 45 min',  minutes: 45  },
    { label: '🍲 No rush', sub: 'any time',  minutes: null },
  ]

  async function getSuggestions() {
    if (items.length === 0) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/cook-tonight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, servings, maxMinutes, vegetarian }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Server error')
      setSuggestions(json.suggestions ?? [])
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function saveToRecipes(s: Suggestion, index: number) {
    setSaving(index)
    const { data: newRecipe } = await supabase
      .from('recipes')
      .insert({ name: s.name, household_id: profile?.household_id, source: 'ai', added_by: profile?.display_name })
      .select('id')
      .single()

    if (newRecipe && s.key_ingredients.length > 0) {
      await supabase.from('recipe_ingredients').insert(
        s.key_ingredients.map((name, i) => ({
          recipe_id: newRecipe.id,
          household_id: profile?.household_id,
          name,
          sort_order: i,
        }))
      )
    }
    setSaved(prev => new Set(prev).add(index))
    setSaving(null)
  }

  async function addMissingToShopping(s: Suggestion, index: number) {
    if (s.missing.length === 0) return
    setAddingToShop(index)
    await supabase.from('shopping_items').insert(
      s.missing.map(name => ({
        name,
        is_ticked: false,
        household_id: profile?.household_id,
        added_by: profile?.display_name,
      }))
    )
    setAddedToShop(prev => new Set(prev).add(index))
    setAddingToShop(null)
  }

  return (
    <>
      <div className="fixed inset-0 z-[200] bg-black/40 flex items-end justify-center" onClick={onClose}>
        <div
          className="bg-white w-full max-w-md rounded-t-3xl flex flex-col"
          style={{ maxHeight: '85dvh' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="flex-shrink-0 pt-3 pb-1 flex justify-center">
            <div className="w-10 h-1 bg-slate-200 rounded-full" />
          </div>

          <div className="flex-shrink-0 px-6 pt-2 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">🍽️ What to cook tonight?</h2>
              <p className="text-xs text-slate-400 mt-0.5">Based on what&apos;s in your pantry</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">✕</button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">

            {/* Step 1 — settings */}
            {!loading && !done && (
              <div className="pt-2">
                {items.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <p className="text-3xl mb-3">🛒</p>
                    <p className="text-sm font-medium">Your pantry is empty</p>
                    <p className="text-xs mt-1">Add some items to get recipe suggestions</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-3">How many people are you cooking for?</p>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setServings(s => Math.max(1, s - 1))}
                          className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-2xl font-semibold transition-colors"
                        >
                          −
                        </button>
                        <span className="text-3xl font-bold text-slate-800 w-10 text-center">{servings}</span>
                        <button
                          onClick={() => setServings(s => Math.min(12, s + 1))}
                          className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-2xl font-semibold transition-colors"
                        >
                          +
                        </button>
                        <span className="text-sm text-slate-400">people</span>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">How much time do you have?</p>
                      <div className="grid grid-cols-3 gap-2">
                        {TIME_PRESETS.map(p => (
                          <button
                            key={p.label}
                            onClick={() => setMaxMinutes(p.minutes)}
                            className={`py-2.5 px-1 rounded-xl border flex flex-col items-center gap-0.5 transition-colors ${
                              maxMinutes === p.minutes
                                ? 'bg-emerald-500 text-white border-emerald-500'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            <span className="text-sm font-medium">{p.label}</span>
                            <span className={`text-xs ${maxMinutes === p.minutes ? 'text-emerald-100' : 'text-slate-400'}`}>{p.sub}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Vegetarian toggle */}
                    <button
                      onClick={() => setVegetarian(v => !v)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                        vegetarian
                          ? 'bg-green-50 border-green-300 text-green-800'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <span className="text-sm font-medium">🥦 Vegetarian only</span>
                      <span className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${vegetarian ? 'bg-green-500' : 'bg-slate-300'}`}>
                        <span className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${vegetarian ? 'translate-x-4' : 'translate-x-0'}`} />
                      </span>
                    </button>

                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button
                      onClick={getSuggestions}
                      className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold rounded-2xl text-base transition-colors"
                    >
                      ✨ Get suggestions
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <p className="text-3xl animate-bounce">🤔</p>
                <p className="text-slate-500 text-sm animate-pulse">Thinking about what you can cook for {servings}…</p>
              </div>
            )}

            {/* Suggestions */}
            {done && !loading && (
              <div className="space-y-4 pt-1">
                <p className="text-xs text-slate-400">
                  Suggestions for {servings} {servings === 1 ? 'person' : 'people'}
                  {vegetarian && ' · 🥦 Vegetarian'}
                </p>
                {suggestions.map((s, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{s.emoji}</span>
                        <h3 className="font-semibold text-slate-800">{s.name}</h3>
                      </div>
                      <span className="text-xs text-slate-400 flex-shrink-0 mt-1">⏱ {s.time_minutes} min</span>
                    </div>

                    <p className="text-sm text-slate-600 mb-3">{s.description}</p>

                    {s.key_ingredients.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {s.key_ingredients.map(ing => (
                          <span key={ing} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                            ✓ {ing}
                          </span>
                        ))}
                      </div>
                    )}

                    {s.missing.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {s.missing.map(ing => (
                          <span key={ing} className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-medium">
                            − {ing}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 justify-end mt-1">
                      {s.missing.length > 0 && (
                        <button
                          onClick={() => addMissingToShopping(s, i)}
                          disabled={addingToShop === i || addedToShop.has(i)}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                            addedToShop.has(i)
                              ? 'text-slate-500 bg-slate-100'
                              : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {addedToShop.has(i) ? '✓ Added to list' : addingToShop === i ? '…' : '🛒 Add missing'}
                        </button>
                      )}
                      <button
                        onClick={() => setPlanSuggestion(s)}
                        className="text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        📅 Plan this
                      </button>
                      <button
                        onClick={() => saveToRecipes(s, i)}
                        disabled={saving === i || saved.has(i)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                          saved.has(i)
                            ? 'text-emerald-600 bg-emerald-50'
                            : 'text-slate-500 bg-white border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {saved.has(i) ? '✓ Saved' : saving === i ? '…' : '♡ Save'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {planSuggestion && (
        <PlanRecipeModal
          meal={{ name: planSuggestion.name, keyIngredients: planSuggestion.key_ingredients }}
          onClose={() => setPlanSuggestion(null)}
          onPlanned={() => setPlanSuggestion(null)}
        />
      )}
    </>
  )
}
