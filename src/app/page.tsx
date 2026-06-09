'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import AddPantryItemModal from '@/components/AddPantryItemModal'
import ImportReceiptModal from '@/components/ImportReceiptModal'
import { type Category, CATEGORIES } from '@/lib/categories'

interface PantryItem {
  id: string
  name: string
  category: Category
  quantity: string | null
  unit: string | null
  expiry_date: string | null
  shopping_alert_dismissed: boolean
}

function isExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) return false
  const diff = (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= 3
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr).getTime() < Date.now()
}

function groupByName(items: PantryItem[]): PantryItem[][] {
  const map = new Map<string, PantryItem[]>()
  for (const item of items) {
    const key = item.name.trim().toLowerCase()
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return Array.from(map.values())
}

function groupQuantity(group: PantryItem[]): string {
  if (group.length === 1) {
    return [group[0].quantity, group[0].unit].filter(Boolean).join(' ')
  }
  const nums = group.map(i => parseFloat(i.quantity ?? 'NaN'))
  const unit = group[0].unit
  const sameUnit = group.every(i => i.unit === unit)
  if (nums.every(n => !isNaN(n)) && sameUnit) {
    const total = nums.reduce((a, b) => a + b, 0)
    return `${total}${unit ? ' ' + unit : ''}`
  }
  return `${group.length}×`
}

export default function PantryPage() {
  const { profile } = useAuth()
  const [items, setItems]                         = useState<PantryItem[]>([])
const [showModal, setShowModal]                 = useState(false)
  const [showImportModal, setShowImportModal]     = useState(false)
  const [showCookModal, setShowCookModal]         = useState(false)
  const [editItem, setEditItem]                   = useState<PantryItem | null>(null)
  const [expandedCategory, setExpandedCategory]     = useState<Category | null>(null)
  const [expiredExpanded, setExpiredExpanded]           = useState(false)
  const [expiringSoonExpanded, setExpiringSoonExpanded] = useState(false)
  const [recentlySent, setRecentlySent]   = useState<Set<string>>(new Set())
  const [shoppingNames, setShoppingNames] = useState<Set<string>>(new Set())

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('pantry_items')
      .select('*')
      .order('created_at', { ascending: false })
    setItems(data ?? [])
  }, [])

  const fetchShoppingNames = useCallback(async () => {
    const { data } = await supabase.from('shopping_items').select('name').eq('is_ticked', false)
    setShoppingNames(new Set((data ?? []).map(i => i.name.toLowerCase())))
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => { fetchShoppingNames() }, [fetchShoppingNames])

  async function deleteGroup(ids: string[]) {
    await supabase.from('pantry_items').delete().in('id', ids)
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)))
  }

  async function sendExpiredGroup(group: PantryItem[]) {
    const { error } = await supabase.from('shopping_items').insert({
      name: group[0].name,
      quantity: groupQuantity(group) || null,
      is_ticked: false,
      household_id: profile?.household_id,
      added_by: profile?.display_name,
    })
    if (error) { console.error('sendExpiredGroup:', error); return }
    const ids = group.map(i => i.id)
    await supabase.from('pantry_items').delete().in('id', ids)
    setItems(prev => prev.filter(i => !ids.includes(i.id)))
  }

  async function discardExpiredGroup(group: PantryItem[]) {
    const ids = group.map(i => i.id)
    await supabase.from('pantry_items').delete().in('id', ids)
    setItems(prev => prev.filter(i => !ids.includes(i.id)))
  }

  async function sendExpiringSoonGroup(group: PantryItem[]) {
    const key = group[0].name
    const { error } = await supabase.from('shopping_items').insert({
      name: key,
      quantity: groupQuantity(group) || null,
      is_ticked: false,
      household_id: profile?.household_id,
      added_by: profile?.display_name,
    })
    if (error) { console.error('sendExpiringSoonGroup:', error); return }
    const ids = group.map(i => i.id)
    await supabase.from('pantry_items').update({ shopping_alert_dismissed: true }).in('id', ids)
    setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, shopping_alert_dismissed: true } : i))
    setShoppingNames(prev => new Set([...prev, key.toLowerCase()]))
    setRecentlySent(prev => new Set([...prev, key]))
    setTimeout(() => setRecentlySent(prev => { const s = new Set(prev); s.delete(key); return s }), 2000)
  }

  const expiringSoon = items.filter(i => isExpiringSoon(i.expiry_date) && !i.shopping_alert_dismissed)
  const expired      = items.filter(i => isExpired(i.expiry_date) && !i.shopping_alert_dismissed)

  return (
    <div className="px-4 pt-3">
      {/* Header */}
      <div className="mb-3">
        <h1 className="text-xl font-bold text-slate-800">🏠 Home Hub</h1>
        <p className="text-slate-500 text-xs mt-0.5">
          {profile?.display_name ? `Good to see you, ${profile.display_name}! 👋` : 'Good to see you! 👋'}
        </p>
      </div>

      {/* Expiry alerts */}
      {expired.length > 0 && (
        <div className="mb-2 bg-red-50 border border-red-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setExpiredExpanded(v => !v)}
            className="w-full flex items-center gap-2 px-3 py-2.5"
          >
            <span className="text-lg">🚨</span>
            <p className="flex-1 text-left font-semibold text-red-800 text-xs">
              {groupByName(expired).length} item{groupByName(expired).length > 1 ? 's' : ''} expired — tap to manage
            </p>
            <span className={`text-red-400 text-base transition-transform duration-200 ${expiredExpanded ? 'rotate-90' : ''}`}>›</span>
          </button>
          {expiredExpanded && (
            <div className="border-t border-red-200 divide-y divide-red-100">
              {groupByName(expired).map(group => (
                <div key={group[0].id} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-red-900 truncate">{group[0].name}</p>
                    {groupQuantity(group) && <p className="text-xs text-red-400">{groupQuantity(group)}</p>}
                  </div>
                  <button
                    onClick={() => sendExpiredGroup(group)}
                    className="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-lg font-medium flex-shrink-0"
                  >
                    + Shopping list
                  </button>
                  <button
                    onClick={() => discardExpiredGroup(group)}
                    className="text-xs bg-red-100 hover:bg-red-200 text-red-600 px-2 py-1 rounded-lg font-medium flex-shrink-0"
                  >
                    🗑️ Discard
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {expiringSoon.length > 0 && (
        <div className="mb-2 bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setExpiringSoonExpanded(v => !v)}
            className="w-full flex items-center gap-2 px-3 py-2.5"
          >
            <span className="text-lg">⏰</span>
            <p className="flex-1 text-left font-semibold text-amber-800 text-xs">
              {groupByName(expiringSoon).length} item{groupByName(expiringSoon).length > 1 ? 's' : ''} expiring soon — tap to manage
            </p>
            <span className={`text-amber-400 text-base transition-transform duration-200 ${expiringSoonExpanded ? 'rotate-90' : ''}`}>›</span>
          </button>
          {expiringSoonExpanded && (
            <div className="border-t border-amber-200 divide-y divide-amber-100">
              {groupByName(expiringSoon).map(group => (
                <div key={group[0].id} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-amber-900 truncate">{group[0].name}</p>
                    {groupQuantity(group) && <p className="text-xs text-amber-500">{groupQuantity(group)}</p>}
                  </div>
                  <button
                    onClick={() => sendExpiringSoonGroup(group)}
                    className={`text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0 transition-colors ${
                      recentlySent.has(group[0].name)
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-400 hover:bg-amber-500 text-white'
                    }`}
                  >
                    {recentlySent.has(group[0].name) ? '✓ Added' : '+ Shopping list'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {expired.length === 0 && expiringSoon.length === 0 && (
        <div className="mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex gap-2 items-center">
          <span className="text-lg">⏰</span>
          <p className="text-amber-800 text-xs font-semibold">No expiry alerts</p>
        </div>
      )}

      {/* Cook tonight button */}
      <button
        onClick={() => setShowCookModal(true)}
        className="w-full mb-3 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
      >
        🍽️ What can I cook tonight?
      </button>

      {/* Category cards */}
      <div className="space-y-2 mb-3">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pantry</h2>

        {CATEGORIES.map((cat) => {
            const catItems = items.filter((i) => i.category === cat.value)
            const isOpen   = expandedCategory === cat.value
            const groups   = groupByName(catItems)

            return (
              <div key={cat.value}>
                {/* Category header */}
                <button
                  onClick={() => setExpandedCategory(isOpen ? null : cat.value)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border ${cat.color} cursor-pointer active:scale-[0.98] transition-transform`}
                >
                  <span className="text-xl">{cat.emoji}</span>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-slate-800 text-sm">{cat.label}</p>
                    <p className="text-xs text-slate-500">
                      {groups.length === 0 ? 'Nothing added yet' : `${groups.length} item${groups.length > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <span className={`text-slate-400 text-lg transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                </button>

                {/* Items list — grouped */}
                {isOpen && groups.length > 0 && (
                  <div className="mt-1 ml-2 space-y-1">
                    {groups.map((group) => {
                      const anyExpired = group.some(i => isExpired(i.expiry_date))
                      const anySoon    = group.some(i => isExpiringSoon(i.expiry_date))
                      const onList     = group.some(i => shoppingNames.has(i.name.toLowerCase()))
                      const wasOnList  = !onList && group.some(i => i.shopping_alert_dismissed)
                      const qty        = groupQuantity(group)
                      const ids        = group.map(i => i.id)
                      return (
                        <div
                          key={group[0].id}
                          className={`flex items-center gap-3 px-4 py-3 bg-white border rounded-xl ${
                            anyExpired ? 'border-red-200' : anySoon ? 'border-amber-200' : 'border-slate-100'
                          }`}
                        >
                          <div className="flex-1">
                            <p className="font-medium text-slate-700">{group[0].name}</p>
                            <p className="text-xs text-slate-400">
                              {qty}
                              {anyExpired && <span className="text-red-500"> · 🚨 Expired</span>}
                              {!anyExpired && anySoon && (
                                <span className="text-amber-500">
                                  {' · ⏰ Expiring soon'}
                                  {onList    && ' · 🛒 On list'}
                                  {wasOnList && ' · ✓ Was on list'}
                                </span>
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() => setEditItem(group[0])}
                            className="text-slate-300 hover:text-slate-500 text-base transition-colors px-1"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => deleteGroup(ids)}
                            className="text-slate-300 hover:text-red-400 text-lg transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {isOpen && groups.length === 0 && (
                  <div className="mt-1 ml-2 px-4 py-3 text-slate-400 text-sm italic">
                    Nothing in this category yet
                  </div>
                )}
              </div>
            )
          })
        }
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pb-4">
        <button
          onClick={() => setShowModal(true)}
          className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
        >
          + Add Item
        </button>
        <button
          onClick={() => setShowImportModal(true)}
          className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold rounded-xl text-sm transition-colors shadow-sm"
        >
          🧾 From Receipt
        </button>
      </div>

      {/* Add pantry item modal */}
      {showModal && (
        <AddPantryItemModal
          onClose={() => setShowModal(false)}
          onAdded={fetchItems}
        />
      )}

      {/* Edit pantry item modal */}
      {editItem && (
        <AddPantryItemModal
          editItem={editItem}
          onClose={() => setEditItem(null)}
          onAdded={() => { fetchItems(); setEditItem(null) }}
        />
      )}

      {showImportModal && (
        <ImportReceiptModal
          onClose={() => setShowImportModal(false)}
          onAdded={fetchItems}
        />
      )}

      {/* Cook tonight — placeholder modal */}
      {showCookModal && (
        <div
          className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center px-6"
          onClick={() => setShowCookModal(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 w-full max-w-sm text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-4xl mb-3">🍽️</p>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Coming soon!</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              This will suggest meals based on what&apos;s in your pantry and what&apos;s expiring soon.
            </p>
            <button
              onClick={() => setShowCookModal(false)}
              className="mt-5 w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-2xl transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
