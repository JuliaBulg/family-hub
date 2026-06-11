'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { CATEGORIES } from '@/lib/categories'
import AddShoppingItemModal from '@/components/AddShoppingItemModal'
import { useT, useCatLabel } from '@/lib/i18n'

// Survives component unmount — prevents deleted items reappearing during navigation
const deletedIds = new Set<string>()

interface ShoppingItem {
  id: string
  name: string
  store: string
  quantity: string | null
  is_ticked: boolean
  added_by: string | null
  category: string | null
}

export default function ShoppingPage() {
  const { profile } = useAuth()
  const t = useT()
  const catLabel = useCatLabel()
  const [items, setItems]               = useState<ShoppingItem[]>([])
  const [showModal, setShowModal]       = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ShoppingItem | null>(null)
  const undoTimerRef                    = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    await supabase.from('shopping_items').update({ is_ticked: !item.is_ticked }).eq('id', item.id)
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_ticked: !i.is_ticked } : i))
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

  // Group items by category, preserving CATEGORIES order; only populated groups shown
  const groups = CATEGORIES
    .map(cat => ({
      cat,
      items: items.filter(i => (i.category ?? 'other') === cat.value),
    }))
    .filter(g => g.items.length > 0)

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

        <div className="space-y-4 mb-4">
          {items.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-4xl mb-3">🛒</p>
              <p className="text-base font-medium">{t('shopping_empty')}</p>
              <p className="text-sm mt-1">{t('shopping_empty_sub')}</p>
            </div>
          ) : (
            groups.map(({ cat, items: groupItems }) => (
              <div key={cat.value}>
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  <span className="text-base">{cat.emoji}</span>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {catLabel(cat.value)}
                  </p>
                  <span className="text-xs text-slate-300 font-medium">
                    {groupItems.filter(i => !i.is_ticked).length}/{groupItems.length}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {groupItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-slate-100">
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
                          {[item.quantity, item.added_by ? `by ${item.added_by}` : null].filter(Boolean).join(' · ')}
                        </p>
                      </div>

                      <button onClick={() => deleteItem(item)} className="text-slate-300 hover:text-red-400 text-lg transition-colors">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
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
    </div>
  )
}
