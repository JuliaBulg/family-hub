'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import AddRecipeModal from '@/components/AddRecipeModal'
import { FAMILY_RECIPES_PRELOAD } from '@/lib/family-recipes'

interface RecipeIngredient {
  id: string
  name: string
  quantity: string | null
  unit: string | null
  sort_order: number
}

interface Recipe {
  id: string
  name: string
  source: string
  added_by: string | null
  created_at: string
  ingredients: RecipeIngredient[]
}

const SOURCE_LABEL: Record<string, string> = {
  preloaded: '📚 Family',
  manual:    '✏️ Added',
  ai:        '🤖 AI',
}

export default function RecipesPage() {
  const { profile } = useAuth()
  const [recipes, setRecipes]     = useState<Recipe[]>([])
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState<Set<string>>(new Set())
  const [showModal, setShowModal] = useState(false)
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null)
  const [deleting, setDeleting]   = useState<string | null>(null)

  const fetchRecipes = useCallback(async () => {
    const { data } = await supabase
      .from('recipes')
      .select('*, ingredients:recipe_ingredients(*)')
      .order('created_at', { ascending: true })

    setRecipes((data ?? []) as Recipe[])
    setLoading(false)
  }, [])

  useEffect(() => {
    async function init() {
      const { count } = await supabase
        .from('recipes')
        .select('id', { count: 'exact', head: true })

      if (count === 0) {
        await preloadRecipes()
      }
      await fetchRecipes()
    }
    init()
  }, [fetchRecipes])

  async function preloadRecipes() {
    for (const r of FAMILY_RECIPES_PRELOAD) {
      const { data: newRecipe } = await supabase
        .from('recipes')
        .insert({ name: r.name, household_id: profile?.household_id, source: 'preloaded' })
        .select('id')
        .single()

      if (newRecipe && r.ingredients.length > 0) {
        await supabase.from('recipe_ingredients').insert(
          r.ingredients.map(ing => ({
            recipe_id: newRecipe.id,
            household_id: profile?.household_id,
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            sort_order: ing.sort_order,
          }))
        )
      }
    }
  }

  async function deleteRecipe(id: string) {
    setDeleting(id)
    await supabase.from('recipes').delete().eq('id', id)
    setRecipes(prev => prev.filter(r => r.id !== id))
    setDeleting(null)
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-full py-24 text-slate-400 text-sm animate-pulse">
        Loading recipes…
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 px-4 pt-4 pb-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-slate-800">📖 Recipes</h1>
            <p className="text-xs text-slate-400">{recipes.length} saved</p>
          </div>
          <button
            onClick={() => { setEditRecipe(null); setShowModal(true) }}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            + Add
          </button>
        </div>

        {/* Recipe list */}
        {recipes.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <p className="text-4xl mb-3">📖</p>
            <p className="text-sm font-medium">No recipes yet</p>
            <p className="text-xs mt-1">Tap &quot;+ Add&quot; to save your first recipe</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recipes.map(recipe => {
              const isOpen = expanded.has(recipe.id)
              const ings   = [...(recipe.ingredients ?? [])].sort((a, b) => a.sort_order - b.sort_order)

              return (
                <div
                  key={recipe.id}
                  className="bg-white border border-slate-100 rounded-2xl overflow-hidden"
                >
                  {/* Card header — tap to expand */}
                  <button
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                    onClick={() => toggleExpand(recipe.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{recipe.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">
                          {ings.length} ingredient{ings.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-slate-300">·</span>
                        <span className="text-xs text-slate-400">{SOURCE_LABEL[recipe.source] ?? '✏️ Added'}</span>
                      </div>
                    </div>
                    <span className={`text-slate-400 text-sm transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                      ▾
                    </span>
                  </button>

                  {/* Expanded ingredients */}
                  {isOpen && (
                    <div className="border-t border-slate-50 px-4 pb-3">
                      {ings.length > 0 ? (
                        <div className="pt-2 space-y-1">
                          {ings.map(ing => (
                            <div key={ing.id} className="flex items-baseline gap-2 py-1">
                              <span className="text-xs text-emerald-500 font-bold">·</span>
                              <p className="text-sm text-slate-700 flex-1">{ing.name}</p>
                              {(ing.quantity || ing.unit) && (
                                <p className="text-xs text-slate-400 flex-shrink-0">
                                  {[ing.quantity, ing.unit].filter(Boolean).join(' ')}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 pt-2">No ingredients listed</p>
                      )}

                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => { setEditRecipe(recipe); setShowModal(true) }}
                          className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => deleteRecipe(recipe.id)}
                          disabled={deleting === recipe.id}
                          className="text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {deleting === recipe.id ? '…' : '✕ Delete'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <AddRecipeModal
          recipe={editRecipe ?? undefined}
          onClose={() => { setShowModal(false); setEditRecipe(null) }}
          onSaved={() => { setShowModal(false); setEditRecipe(null); void fetchRecipes() }}
        />
      )}
    </div>
  )
}
