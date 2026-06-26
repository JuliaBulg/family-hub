'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import AddShoppingItemModal from '@/components/AddShoppingItemModal'
import { useT } from '@/lib/i18n'

// Survives component unmount — prevents deleted items reappearing during navigation
const deletedIds = new Set<string>()

const CATEGORY_ORDER: Record<string, number> = {
  food_veg: 0, food_dairy: 1, food_meat: 2, food_bread: 3,
  food_dry: 4, food_frozen: 5, food_snacks: 6, food_drinks: 7,
  food_other: 8, food: 8, drinks: 7,
  household: 9, personal: 10, medicine: 11, pets: 12, other: 13,
}
function catOrder(cat: string | null): number {
  return cat ? (CATEGORY_ORDER[cat] ?? 13) : 13
}

interface ShoppingItem {
  id: string
  name: string
  store: string
  quantity: string | null      // legacy free-text fallback
  pcs: number | null
  amount_per_pack: number | null
  unit: string | null
  is_ticked: boolean
  added_by: string | null
  category: string | null
}

function formatQuantity(item: ShoppingItem): string | null {
  const p = item.pcs
  const a = item.amount_per_pack
  const u = item.unit
  if (p && a && u) return `${p} × ${a} ${u}`
  if (p && a)      return `${p} × ${a}`
  if (a && u)      return `${a} ${u}`
  if (p && u)      return `${p} ${u}`
  if (p)           return `${p} pcs`
  if (a)           return String(a)
  return item.quantity ?? null
}

function pantryTotal(item: ShoppingItem): { quantity: string; unit: string | null } {
  const p = item.pcs ?? 1
  const a = item.amount_per_pack
  if (a) return { quantity: String(p * a), unit: item.unit ?? null }
  if (item.pcs) return { quantity: String(item.pcs), unit: item.unit ?? null }
  return { quantity: item.quantity ?? '', unit: null }
}

export default function ShoppingPage() {
  const { profile } = useAuth()
  const t = useT()
  const [items, setItems]                 = useState<ShoppingItem[]>([])
  const [showModal, setShowModal]         = useState(false)
  const [editItem, setEditItem]           = useState<ShoppingItem | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ShoppingItem | null>(null)
  const [pantryPrompt, setPantryPrompt]   = useState<ShoppingItem | null>(null)
  const undoTimerRef                      = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchItems = useCallback(async () => {
    if (!profile?.household_id) return
    const { data } = await supabase
      .from('shopping_items')
      .select('*')
      .eq('household_id', profile.household_id)
      .order('created_at', { ascending: true })
    setItems((data ?? []).filter(i => !deletedIds.has(i.id)))
  }, [profile?.household_id])

  useEffect(() => { fetchItems() }, [fetchItems])

  async function toggleChecked(item: ShoppingItem) {
    const newTicked = !item.is_ticked
    await supabase.from('shopping_items').update({ is_ticked: newTicked }).eq('id', item.id)
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_ticked: newTicked } : i))
    // Offer to add to pantry when ticking an item that has quantity info
    if (newTicked && (item.pcs || item.amount_per_pack || item.unit)) {
      setPantryPrompt(item)
    }
  }

  async function addToPantry(item: ShoppingItem) {
    const { quantity, unit } = pantryTotal(item)
    await supabase.from('pantry_items').insert({
      name: item.name,
      quantity: quantity || null,
      unit: unit || null,
      category: item.category ?? 'food',
      household_id: profile?.household_id,
      added_by: profile?.display_name,
    })
    setPantryPrompt(null)
  }

  function deleteItem(item: ShoppingItem) {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    deletedIds.add(item.id)
    void supabase.from('shopping_items').delete().eq('id', item.id).then(() => {
      deletedIds.delete(item.id)
    })
    setItems(prev => prev.filter(i => i.id !== item.id))
    setPendingDelete(item)
    undoTimerRef.current = setTimeout(() => setPendingDelete(null), 6000)
  }

  async function undoDelete() {
    if (!pendingDelete) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    deletedIds.delete(pendingDelete.id)
    const { data } = await supabase.from('shopping_items').insert({
      name: pendingDelete.name,
      quantity: pendingDelete.quantity,
      pcs: pendingDelete.pcs,
      amount_per_pack: pendingDelete.amount_per_pack,
      unit: pendingDelete.unit,
      store: pendingDelete.store,
      category: pendingDelete.category ?? 'other',
      is_ticked: pendingDelete.is_ticked,
      added_by: pendingDelete.added_by,
      household_id: profile?.household_id,
    }).select().single()
    if (data) setItems(prev => [...prev, data as ShoppingItem])
    setPendingDelete(null)
  }

  async function clearDone() {
    const doneIds = items.filter((i) => i.is_ticked).map((i) => i.id)
    if (doneIds.length === 0) return
    await supabase.from('shopping_items').delete().in('id', doneIds)
    setItems((prev) => prev.filter((i) => !i.is_ticked))
  }

  const doneCount = items.filter((i) => i.is_ticked).length

  const sortedItems = [
    ...items.filter(i => !i.is_ticked).sort((a, b) => catOrder(a.category) - catOrder(b.category)),
    ...items.filter(i => i.is_ticked).sort((a, b) => catOrder(a.category) - catOrder(b.category)),
  ]

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 px-4 pt-4">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">🛒 {t('shopping_title')}</h1>
            <p className="text-slate-500 text-xs mt-0.5">
              {items.length === 0
                ? t('shopping_empty')
                : `${items.length - doneCount} left · ${doneCount} done`}
            </p>
          </div>
          {doneCount > 0 && (
            <button
              onClick={clearDone}
              className="text-xs text-slate-400 hover:text-red-400 transition-colors mt-1"
            >
              Done shopping ({doneCount})
            </button>
          )}
        </div>

        <div className="space-y-2 mb-4">
          {sortedItems.map((item) => (
            <div key={item.id}>
              <div className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-slate-100">
                <button
                  onClick={() => toggleChecked(item)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    item.is_ticked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'
                  }`}
                >
                  {item.is_ticked && <span className="text-xs">✓</span>}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium transition-all ${item.is_ticked ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                    {item.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {[formatQuantity(item), item.added_by ? `by ${item.added_by}` : null].filter(Boolean).join(' · ')}
                  </p>
                </div>

                <button onClick={() => setEditItem(item)} className="text-slate-300 hover:text-slate-500 text-sm transition-colors px-1">
                  ✏️
                </button>
                <button onClick={() => deleteItem(item)} className="text-slate-300 hover:text-red-400 text-lg transition-colors">
                  ✕
                </button>
              </div>

              {/* Pantry prompt — appears inline below the ticked item */}
              {pantryPrompt?.id === item.id && (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mt-1">
                  <p className="text-xs text-emerald-700 font-medium truncate mr-2">
                    Add <span className="font-bold">{item.name}</span> · {pantryTotal(item).quantity}{pantryTotal(item).unit ? ` ${pantryTotal(item).unit}` : ''} to pantry?
                  </p>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => addToPantry(item)}
                      className="text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      {t('smodal_add_to_pantry')}
                    </button>
                    <button
                      onClick={() => setPantryPrompt(null)}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg transition-colors"
                    >
                      {t('smodal_skip')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {items.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <p className="text-4xl mb-3">🛒</p>
              <p className="text-base font-medium">{t('shopping_empty')}</p>
              <p className="text-sm mt-1">{t('shopping_empty_sub')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 px-4 pt-2 pb-3 border-t border-slate-100 bg-slate-50">
        {pendingDelete && (
          <div className="flex items-center justify-between bg-slate-800 text-white rounded-xl px-4 py-2.5 mb-2">
            <p className="text-sm truncate mr-3"><span className="font-medium">{pendingDelete.name}</span> {t('shopping_deleted').toLowerCase()}</p>
            <button onClick={undoDelete} className="text-emerald-400 font-semibold text-sm flex-shrink-0">
              {t('shopping_undo')}
            </button>
          </div>
        )}
        <button
          onClick={() => setShowModal(true)}
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
        >
          {t('btn_add')} to list
        </button>
      </div>

      {showModal && (
        <AddShoppingItemModal
          onClose={() => setShowModal(false)}
          onAdded={fetchItems}
        />
      )}

      {editItem && (
        <AddShoppingItemModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onAdded={() => { setEditItem(null); void fetchItems() }}
        />
      )}
    </div>
  )
}
