'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import AddPantryItemModal from '@/components/AddPantryItemModal'
import ImportReceiptModal from '@/components/ImportReceiptModal'
import CookTonightModal from '@/components/CookTonightModal'
import { type Category, PANTRY_TOP_CATS, FOOD_SUBCATEGORIES, isFoodFamily, foodSubcatOf } from '@/lib/categories'
import { useT, useCatLabel } from '@/lib/i18n'

interface PantryItem {
  id: string
  name: string
  category: Category
  quantity: string | null
  unit: string | null
  expiry_date: string | null
  shopping_alert_dismissed: boolean
  consumption_days: number | null
  daily_usage: number | null
  daily_usage_unit: string | null
  date_opened: string | null
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

function daysRemaining(item: { quantity: string | null; daily_usage: number | null; consumption_days: number | null; date_opened: string | null }): number | null {
  // Rate-based: quantity / daily_usage
  if (item.daily_usage && item.daily_usage > 0 && item.quantity) {
    const qty = parseFloat(item.quantity)
    if (!isNaN(qty)) return Math.round(qty / item.daily_usage)
  }
  // Duration-based: date_opened + consumption_days
  if (item.consumption_days && item.consumption_days > 0) {
    const opened = item.date_opened ? new Date(item.date_opened) : new Date()
    const finishMs = opened.getTime() + item.consumption_days * 24 * 60 * 60 * 1000
    return Math.round((finishMs - Date.now()) / (1000 * 60 * 60 * 24))
  }
  return null
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
  const t = useT()
  const catLabel = useCatLabel()
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
  const [search, setSearch]               = useState('')
  const [reservations, setReservations]   = useState<Map<string, { mealName: string; mealDate: string }>>(new Map())

  const fetchItems = useCallback(async () => {
    if (!profile?.household_id) return
    const { data } = await supabase
      .from('pantry_items')
      .select('*')
      .eq('household_id', profile.household_id)
      .order('created_at', { ascending: false })
    setItems(data ?? [])
  }, [profile?.household_id])

  const fetchShoppingNames = useCallback(async () => {
    if (!profile?.household_id) return
    const { data } = await supabase.from('shopping_items').select('name')
      .eq('household_id', profile.household_id)
      .eq('is_ticked', false)
    setShoppingNames(new Set((data ?? []).map(i => i.name.toLowerCase())))
  }, [profile?.household_id])

  const fetchReservations = useCallback(async () => {
    if (!profile?.household_id) return
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('meal_ingredients')
      .select('pantry_item_id, meals!inner(name, date, cooked_at, household_id)')
      .not('pantry_item_id', 'is', null)
      .eq('meals.household_id', profile.household_id)
    const map = new Map<string, { mealName: string; mealDate: string }>()
    for (const row of data ?? []) {
      const meal = row.meals as unknown as { name: string; date: string; cooked_at: string | null } | null
      if (!meal || meal.cooked_at || meal.date < today) continue
      if (row.pantry_item_id) map.set(row.pantry_item_id, { mealName: meal.name, mealDate: meal.date })
    }
    setReservations(map)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => { fetchShoppingNames() }, [fetchShoppingNames])
  useEffect(() => { fetchReservations() }, [fetchReservations])

  async function deleteGroup(ids: string[]) {
    await supabase.from('pantry_items').delete().in('id', ids)
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)))
  }

  async function sendExpiredGroup(group: PantryItem[]) {
    const qty = groupQuantity(group)
    const { error } = await supabase.from('shopping_items').insert({
      name: group[0].name,
      amount_per_pack: qty ? parseFloat(qty) || null : null,
      unit: group[0].unit ?? null,
      category: group[0].category,
      is_ticked: false,
      household_id: profile?.household_id,
      added_by: profile?.display_name,
    })
    if (error) { console.error('sendExpiredGroup:', error); return }
    const ids = group.map(i => i.id)
    await supabase.from('pantry_items').delete().in('id', ids)
    setItems(prev => prev.filter(i => !ids.includes(i.id)))
  }

  async function adjustQty(item: PantryItem, delta: number) {
    const current = parseFloat(item.quantity ?? '0') || 0
    const next = Math.max(0, current + delta)
    if (next === 0) {
      await supabase.from('pantry_items').delete().eq('id', item.id)
      setItems(prev => prev.filter(i => i.id !== item.id))
    } else {
      await supabase.from('pantry_items').update({ quantity: String(next) }).eq('id', item.id)
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: String(next) } : i))
    }
  }

  async function discardExpiredGroup(group: PantryItem[]) {
    const ids = group.map(i => i.id)
    await supabase.from('pantry_items').delete().in('id', ids)
    setItems(prev => prev.filter(i => !ids.includes(i.id)))
  }

  async function sendExpiringSoonGroup(group: PantryItem[]) {
    const key = group[0].name
    const qty = groupQuantity(group)
    const { error } = await supabase.from('shopping_items').insert({
      name: key,
      amount_per_pack: qty ? parseFloat(qty) || null : null,
      unit: group[0].unit ?? null,
      category: group[0].category,
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

  const expiringSoon   = items.filter(i => isExpiringSoon(i.expiry_date) && !i.shopping_alert_dismissed)
  const expired        = items.filter(i => isExpired(i.expiry_date) && !i.shopping_alert_dismissed)
  const searchTerm     = search.trim().toLowerCase()
  const searchResults  = searchTerm
    ? groupByName(items.filter(i => i.name.toLowerCase().includes(searchTerm)))
    : []

  function renderItemCard(group: PantryItem[]) {
    const anyExpired  = group.some(i => isExpired(i.expiry_date))
    const anySoon     = group.some(i => isExpiringSoon(i.expiry_date))
    const onList      = group.some(i => shoppingNames.has(i.name.toLowerCase()))
    const wasOnList   = !onList && group.some(i => i.shopping_alert_dismissed)
    const reservation = group.map(i => reservations.get(i.id)).find(Boolean)
    const qty         = groupQuantity(group)
    const ids         = group.map(i => i.id)
    const days        = daysRemaining(group[0])
    const consumptionLow = days !== null && days <= 7
    const hasNumQty   = group[0].quantity != null && !isNaN(parseFloat(group[0].quantity))
    return (
      <div
        key={group[0].id}
        className={`flex items-center gap-2 px-3 py-2.5 bg-white border rounded-xl ${
          anyExpired ? 'border-red-200' : anySoon || consumptionLow ? 'border-amber-200' : reservation ? 'border-violet-200' : 'border-slate-100'
        }`}
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-700 text-sm truncate">{group[0].name}</p>
          <p className="text-xs text-slate-400">
            {qty}
            {anyExpired && <span className="text-red-500"> · 🚨 {t('pantry_expired_badge')}</span>}
            {!anyExpired && anySoon && (
              <span className="text-amber-500">
                {' · ⏰ '}{t('pantry_expiring_section')}
                {onList    && ` · 🛒 ${t('pantry_on_shopping')}`}
                {wasOnList && ` · ${t('pantry_was_on_list')}`}
              </span>
            )}
            {days !== null && !anyExpired && !anySoon && (
              <span className={days <= 0 ? 'text-red-500' : days <= 7 ? 'text-amber-500' : 'text-slate-400'}>
                {' · '}{days <= 0 ? '⏳ running low' : `~${days}d left`}
              </span>
            )}
            {reservation && <span className="text-violet-500"> · 📅 {reservation.mealName}</span>}
          </p>
        </div>
        {hasNumQty && (
          <button
            onClick={() => void adjustQty(group[0], -1)}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-500 text-sm font-bold transition-colors flex-shrink-0"
          >−</button>
        )}
        <button onClick={() => setEditItem(group[0])} className="text-slate-300 hover:text-slate-500 text-sm transition-colors px-0.5 flex-shrink-0">✏️</button>
        <button onClick={() => void deleteGroup(ids)} className="text-slate-300 hover:text-red-400 text-base transition-colors flex-shrink-0">✕</button>
      </div>
    )
  }

  return (
    <div className="px-4 pt-3">
      {/* Header */}
      <div className="mb-3">
        <h1 className="text-xl font-bold text-slate-800">🏠 Home Hub</h1>
        <p className="text-slate-500 text-xs mt-0.5">
          {profile?.display_name ? `Good to see you, ${profile.display_name}! 👋` : 'Good to see you! 👋'}
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
        <input
          type="text"
          placeholder={t('pantry_search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-emerald-400"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Search results */}
      {searchTerm ? (
        <div className="space-y-1 mb-3">
          {searchResults.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-sm">{t('pantry_search_empty')} &ldquo;{search.trim()}&rdquo;</p>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
              </p>
              {searchResults.map(group => {
                const rawCat      = group[0].category
                const catMeta     = isFoodFamily(rawCat) ? foodSubcatOf(rawCat) : PANTRY_TOP_CATS.find(c => c.value === rawCat)
                const cat         = catMeta
                const anyExpired  = group.some(i => isExpired(i.expiry_date))
                const anySoon     = group.some(i => isExpiringSoon(i.expiry_date))
                const onList      = group.some(i => shoppingNames.has(i.name.toLowerCase()))
                const wasOnList   = !onList && group.some(i => i.shopping_alert_dismissed)
                const reservation = group.map(i => reservations.get(i.id)).find(Boolean)
                const qty         = groupQuantity(group)
                const ids         = group.map(i => i.id)
                const days        = daysRemaining(group[0])
                const consumptionLow = days !== null && days <= 7
                return (
                  <div
                    key={group[0].id}
                    className={`flex items-center gap-3 px-4 py-3 bg-white border rounded-xl ${
                      anyExpired ? 'border-red-200' : anySoon || consumptionLow ? 'border-amber-200' : reservation ? 'border-violet-200' : 'border-slate-100'
                    }`}
                  >
                    <span className="text-lg flex-shrink-0">{cat?.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-700">{group[0].name}</p>
                      <p className="text-xs text-slate-400">
                        {qty}
                        {anyExpired && <span className="text-red-500"> · 🚨 {t('pantry_expired_badge')}</span>}
                        {!anyExpired && anySoon && (
                          <span className="text-amber-500">
                            {' · ⏰ '}{t('pantry_expiring_section')}
                            {onList    && ` · 🛒 ${t('pantry_on_shopping')}`}
                            {wasOnList && ` · ${t('pantry_was_on_list')}`}
                          </span>
                        )}
                        {days !== null && !anyExpired && !anySoon && (
                          <span className={days <= 0 ? 'text-red-500' : days <= 7 ? 'text-amber-500' : 'text-slate-400'}>
                            {' · '}{days <= 0 ? '⏳ running low' : `~${days}d left`}
                          </span>
                        )}
                        {reservation && (
                          <span className="text-violet-500"> · 📅 {reservation.mealName}</span>
                        )}
                      </p>
                    </div>
                    <button onClick={() => setEditItem(group[0])} className="text-slate-300 hover:text-slate-500 text-base transition-colors px-1">✏️</button>
                    <button onClick={() => deleteGroup(ids)} className="text-slate-300 hover:text-red-400 text-lg transition-colors">✕</button>
                  </div>
                )
              })}
            </>
          )}
        </div>
      ) : (
        <>
          {/* Expiry alerts */}
          {expired.length > 0 && (
            <div className="mb-2 bg-red-50 border border-red-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpiredExpanded(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-2.5"
              >
                <span className="text-lg">🚨</span>
                <p className="flex-1 text-left font-semibold text-red-800 text-xs">
                  {groupByName(expired).length} item{groupByName(expired).length > 1 ? 's' : ''} {t('pantry_expired_section').toLowerCase()} — tap to manage
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
                        {t('pantry_add_shopping_list')}
                      </button>
                      <button
                        onClick={() => discardExpiredGroup(group)}
                        className="text-xs bg-red-100 hover:bg-red-200 text-red-600 px-2 py-1 rounded-lg font-medium flex-shrink-0"
                      >
                        {t('pantry_discard')}
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
                  {groupByName(expiringSoon).length} item{groupByName(expiringSoon).length > 1 ? 's' : ''} {t('pantry_expiring_section').toLowerCase()} — tap to manage
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
                        {recentlySent.has(group[0].name) ? t('pantry_added') : t('pantry_add_shopping_list')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cook tonight button */}
          <button
            onClick={() => setShowCookModal(true)}
            className="w-full mb-3 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
          >
            {t('pantry_cook_btn')}
          </button>

          {/* Category cards */}
          <div className="space-y-2 mb-3">

            {/* Food umbrella card */}
            {(() => {
              const foodItems = items.filter(i => isFoodFamily(i.category))
              if (foodItems.length === 0) return null
              const isOpen = expandedCategory === 'food'
              return (
                <div key="food">
                  <button
                    onClick={() => setExpandedCategory(isOpen ? null : 'food')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-green-50 border-green-200 cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    <span className="text-xl">🛒</span>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-slate-800 text-sm">{catLabel('food')}</p>
                      <p className="text-xs text-slate-500">{groupByName(foodItems).length} item{groupByName(foodItems).length !== 1 ? 's' : ''}</p>
                    </div>
                    <span className={`text-slate-400 text-lg transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                  </button>

                  {isOpen && (
                    <div className="mt-1 ml-2 space-y-3">
                      {FOOD_SUBCATEGORIES.map(sub => {
                        const subItems = foodItems.filter(i => foodSubcatOf(i.category).value === sub.value)
                        if (subItems.length === 0) return null
                        return (
                          <div key={sub.value}>
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1 mb-1">
                              {sub.emoji} {catLabel(sub.value)}
                            </p>
                            <div className="space-y-1">
                              {groupByName(subItems).map(group => renderItemCard(group))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Non-food top-level categories */}
            {PANTRY_TOP_CATS.filter(c => c.value !== 'food').map(cat => {
              const catItems = items.filter(i => i.category === cat.value)
              if (catItems.length === 0) return null
              const isOpen = expandedCategory === cat.value
              const groups = groupByName(catItems)
              return (
                <div key={cat.value}>
                  <button
                    onClick={() => setExpandedCategory(isOpen ? null : cat.value)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border ${cat.color} cursor-pointer active:scale-[0.98] transition-transform`}
                  >
                    <span className="text-xl">{cat.emoji}</span>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-slate-800 text-sm">{catLabel(cat.value)}</p>
                      <p className="text-xs text-slate-500">{groups.length} item{groups.length !== 1 ? 's' : ''}</p>
                    </div>
                    <span className={`text-slate-400 text-lg transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                  </button>
                  {isOpen && (
                    <div className="mt-1 ml-2 space-y-1">
                      {groups.map(group => renderItemCard(group))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Buttons */}
      <div className="flex gap-3 pb-4">
        <button
          onClick={() => setShowModal(true)}
          className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
        >
          {t('pantry_add_item')}
        </button>
        <button
          onClick={() => setShowImportModal(true)}
          className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold rounded-xl text-sm transition-colors shadow-sm"
        >
          {t('pantry_import_btn')}
        </button>
      </div>

      {showModal && (
        <AddPantryItemModal
          onClose={() => setShowModal(false)}
          onAdded={fetchItems}
        />
      )}

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

      {showCookModal && (
        <CookTonightModal items={items} onClose={() => setShowCookModal(false)} />
      )}
    </div>
  )
}
