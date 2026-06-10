'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/lib/i18n'

interface RecipeIngredient {
  id?: string
  name: string
  quantity: string
  unit: string
}

interface RecipeIngredientFromDB {
  id?: string
  name: string
  quantity: string | null
  unit: string | null
}

interface Recipe {
  id: string
  name: string
  source: string
}

interface Props {
  recipe?: Recipe & { ingredients?: RecipeIngredientFromDB[] }
  onClose: () => void
  onSaved: () => void
}

function emptyIngredient(): RecipeIngredient {
  return { name: '', quantity: '', unit: '' }
}

export default function AddRecipeModal({ recipe, onClose, onSaved }: Props) {
  const { profile } = useAuth()
  const t = useT()

  const [name, setName] = useState(recipe?.name ?? '')
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    recipe?.ingredients && recipe.ingredients.length > 0
      ? recipe.ingredients.map(i => ({ id: i.id, name: i.name, quantity: i.quantity ?? '', unit: i.unit ?? '' }))
      : [emptyIngredient(), emptyIngredient(), emptyIngredient()]
  )
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function updateIngredient(index: number, field: keyof RecipeIngredient, value: string) {
    setIngredients(prev => prev.map((ing, i) => i === index ? { ...ing, [field]: value } : ing))
  }

  function removeIngredient(index: number) {
    setIngredients(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!name.trim()) return
    const validIngredients = ingredients.filter(i => i.name.trim())
    setLoading(true)
    setError('')

    try {
      if (recipe) {
        await supabase.from('recipes').update({ name: name.trim() }).eq('id', recipe.id)
        await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipe.id)
        if (validIngredients.length > 0) {
          await supabase.from('recipe_ingredients').insert(
            validIngredients.map((ing, i) => ({
              recipe_id: recipe.id,
              household_id: profile?.household_id,
              name: ing.name.trim(),
              quantity: ing.quantity.trim() || null,
              unit: ing.unit.trim() || null,
              sort_order: i,
            }))
          )
        }
      } else {
        const { data: newRecipe, error: dbErr } = await supabase
          .from('recipes')
          .insert({ name: name.trim(), household_id: profile?.household_id, source: 'manual', added_by: profile?.display_name })
          .select('id')
          .single()

        if (dbErr || !newRecipe) throw new Error('Failed to save recipe')

        if (validIngredients.length > 0) {
          await supabase.from('recipe_ingredients').insert(
            validIngredients.map((ing, i) => ({
              recipe_id: newRecipe.id,
              household_id: profile?.household_id,
              name: ing.name.trim(),
              quantity: ing.quantity.trim() || null,
              unit: ing.unit.trim() || null,
              sort_order: i,
            }))
          )
        }
      }

      onSaved()
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[200] flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-t-3xl flex flex-col"
        style={{ maxHeight: '90dvh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-shrink-0 pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        <div className="flex-shrink-0 px-6 pt-2 pb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">
            {recipe ? t('recipe_edit_title') : t('recipe_add_title')}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">✕</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">{t('recipe_name_label')}</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('recipe_name_placeholder')}
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600 mb-2 block">{t('recipe_ingredients_label')}</label>
            <div className="space-y-2">
              {ingredients.map((ing, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={ing.name}
                    onChange={e => updateIngredient(i, 'name', e.target.value)}
                    placeholder={t('recipe_ing_placeholder')}
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <input
                    type="text"
                    value={ing.quantity}
                    onChange={e => updateIngredient(i, 'quantity', e.target.value)}
                    placeholder={t('recipe_qty_placeholder')}
                    className="w-16 px-2 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <input
                    type="text"
                    value={ing.unit}
                    onChange={e => updateIngredient(i, 'unit', e.target.value)}
                    placeholder={t('recipe_unit_placeholder')}
                    className="w-16 px-2 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <button
                    onClick={() => removeIngredient(i)}
                    className="text-slate-300 hover:text-red-400 text-lg transition-colors flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setIngredients(prev => [...prev, emptyIngredient()])}
              className="mt-3 text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              {t('recipe_add_ing')}
            </button>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100">
          <button
            onClick={handleSave}
            disabled={loading || !name.trim()}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-semibold rounded-2xl text-base transition-colors"
          >
            {loading ? t('saving') : recipe ? t('recipe_save_changes_btn') : t('recipe_save_btn')}
          </button>
        </div>
      </div>
    </div>
  )
}
