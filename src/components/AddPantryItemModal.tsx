'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useT, useCatLabel } from '@/lib/i18n'
import { addToShoppingMerged } from '@/lib/shopping'
import { type Category, PANTRY_TOP_CATS, FOOD_SUBCATEGORIES, isFoodFamily } from '@/lib/categories'

// Product catalogue — base consumption rates
interface CatalogEntry {
  keywords: string[]
  consumption_days?: number   // per person
  daily_usage?: number        // per pet per day
  daily_usage_unit?: string
  per: 'person' | 'dog' | 'cat'
}

const CATALOGUE: CatalogEntry[] = [
  { keywords: ['toothpaste', 'hambapasta', 'зубная паста'],               consumption_days: 45, per: 'person' },
  { keywords: ['shampoo', 'šampoon', 'шампунь'],                          consumption_days: 30, per: 'person' },
  { keywords: ['shower gel', 'dušigeel', 'гель для душа', 'bodywash'],    consumption_days: 25, per: 'person' },
  { keywords: ['conditioner', 'palsam', 'кондиционер'],                   consumption_days: 45, per: 'person' },
  { keywords: ['deodorant', 'дезодорант'],                                 consumption_days: 30, per: 'person' },
  { keywords: ['soap', 'seep', 'мыло'],                                    consumption_days: 20, per: 'person' },
  { keywords: ['mascara', 'тушь'],                                         consumption_days: 90, per: 'person' },
  { keywords: ['face cream', 'näokreem', 'крем для лица', 'moisturizer'], consumption_days: 60, per: 'person' },
  { keywords: ['dog food', 'koera toit', 'корм для собак'],               daily_usage: 300, daily_usage_unit: 'g', per: 'dog' },
  { keywords: ['cat food', 'kassi toit', 'корм для кошек'],               daily_usage: 80,  daily_usage_unit: 'g', per: 'cat' },
]

interface Suggestion {
  consumption_days?: number
  daily_usage?: number
  daily_usage_unit?: string
  description: string
}

interface EditItem {
  id: string
  name: string
  category: Category
  quantity: string | null
  unit: string | null
  expiry_date: string | null
  consumption_days: number | null
  daily_usage: number | null
  daily_usage_unit: string | null
  date_opened: string | null
}

interface Props {
  onClose: () => void
  onAdded: () => void
  editItem?: EditItem
}

export default function AddPantryItemModal({ onClose, onAdded, editItem }: Props) {
  const { profile } = useAuth()
  const t = useT()
  const catLabel = useCatLabel()
  const [name, setName]           = useState(editItem?.name ?? '')
  const defaultCat: Category = editItem?.category ?? 'food_other'
  const [category, setCategory]   = useState<Category>(defaultCat)
  const [quantity, setQuantity]   = useState(editItem?.quantity ?? '')
  const [unit, setUnit]           = useState(editItem?.unit ?? '')
  const [expiryDate, setExpiryDate] = useState(editItem?.expiry_date ?? '')
  const [consumptionDays, setConsumptionDays] = useState<string>(editItem?.consumption_days ? String(editItem.consumption_days) : '')
  const [dailyUsage, setDailyUsage]           = useState<string>(editItem?.daily_usage ? String(editItem.daily_usage) : '')
  const [dailyUsageUnit, setDailyUsageUnit]   = useState(editItem?.daily_usage_unit ?? '')
  const [dateOpened, setDateOpened]           = useState(editItem?.date_opened ?? '')
  const [suggestion, setSuggestion]           = useState<Suggestion | null>(null)
  const [showConsumption, setShowConsumption] = useState(
    !!(editItem?.consumption_days || editItem?.daily_usage)
  )
  const [sendingToShop, setSendingToShop] = useState(false)
  const [sentToShop, setSentToShop]       = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // Auto-suggest when name changes
  useEffect(() => {
    const lower = name.toLowerCase().trim()
    if (!lower) { setSuggestion(null); return }

    const entry = CATALOGUE.find(e => e.keywords.some(k => lower.includes(k)))
    if (!entry) { setSuggestion(null); return }

    if (entry.consumption_days && entry.per === 'person') {
      const np = profile?.num_people ?? 1
      const days = Math.round(entry.consumption_days / np)
      setSuggestion({ consumption_days: days, description: `~${days} days for ${np} person${np > 1 ? 's' : ''}` })
    } else if (entry.daily_usage && (entry.per === 'dog' || entry.per === 'cat')) {
      const petCount = (profile?.pets ?? []).find(p => p.type === entry.per)?.count ?? 1
      const total = entry.daily_usage * petCount
      setSuggestion({ daily_usage: total, daily_usage_unit: entry.daily_usage_unit, description: `~${total}${entry.daily_usage_unit}/day for ${petCount} ${entry.per}${petCount > 1 ? 's' : ''}` })
    } else {
      setSuggestion(null)
    }
  }, [name, profile?.num_people, profile?.pets])

  function applySuggestion() {
    if (!suggestion) return
    if (suggestion.consumption_days) setConsumptionDays(String(suggestion.consumption_days))
    if (suggestion.daily_usage) setDailyUsage(String(suggestion.daily_usage))
    if (suggestion.daily_usage_unit) setDailyUsageUnit(suggestion.daily_usage_unit)
    setShowConsumption(true)
  }

  async function sendToShopping() {
    if (!profile?.household_id || !name.trim()) return
    setSendingToShop(true)
    await addToShoppingMerged(
      [{ name: name.trim(), amount_per_pack: quantity ? parseFloat(quantity) || null : null, unit: unit || null }],
      profile.household_id,
      profile.display_name ?? null,
    )
    setSendingToShop(false)
    setSentToShop(true)
    setTimeout(() => setSentToShop(false), 2000)
  }

  async function handleSubmit() {
    if (!name.trim()) return
    setLoading(true)
    setError('')

    // Map food sub-categories to base DB values until schema migration is run
    const dbCategory: Category = category === 'food_drinks' ? 'drinks'
      : (category as string).startsWith('food_') ? 'food'
      : category

    const payload = {
      name: name.trim(),
      category: dbCategory,
      quantity: quantity.trim() || null,
      unit: unit.trim() || null,
      expiry_date: expiryDate || null,
      consumption_days: consumptionDays ? parseInt(consumptionDays) || null : null,
      daily_usage: dailyUsage ? parseFloat(dailyUsage) || null : null,
      daily_usage_unit: dailyUsageUnit.trim() || null,
      date_opened: dateOpened || null,
    }

    let dbErr = null

    if (editItem) {
      const result = await supabase.from('pantry_items').update(payload).eq('id', editItem.id)
      dbErr = result.error
    } else {
      const { data } = payload.expiry_date === null
        ? await supabase.from('pantry_items').select('id, quantity, unit').ilike('name', payload.name).eq('category', payload.category).is('expiry_date', null).limit(1)
        : await supabase.from('pantry_items').select('id, quantity, unit').ilike('name', payload.name).eq('category', payload.category).eq('expiry_date', payload.expiry_date).limit(1)

      const existing = data?.[0]
      if (existing) {
        const eQty = parseFloat(existing.quantity ?? 'NaN')
        const nQty = parseFloat(payload.quantity ?? 'NaN')
        if (!isNaN(eQty) && !isNaN(nQty) && existing.unit === payload.unit) {
          const result = await supabase.from('pantry_items').update({ quantity: String(eQty + nQty) }).eq('id', existing.id)
          dbErr = result.error
        } else {
          const result = await supabase.from('pantry_items').insert({ ...payload, household_id: profile?.household_id, added_by: profile?.display_name })
          dbErr = result.error
        }
      } else {
        const result = await supabase.from('pantry_items').insert({ ...payload, household_id: profile?.household_id, added_by: profile?.display_name })
        dbErr = result.error
      }
    }

    setLoading(false)
    if (dbErr) { setError('Something went wrong. Please try again.'); return }
    onAdded()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[200] flex items-start justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-b-3xl flex flex-col"
        style={{ height: '100dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-6 pt-8 pb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">
            {editItem ? t('pmodal_edit_title') : t('pmodal_add_title')}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">✕</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-scroll px-6 space-y-4 pb-4">

          {/* Name */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">{t('pmodal_name')} *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('pmodal_name_placeholder')}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              autoFocus
            />
            {/* Auto-suggest banner */}
            {suggestion && !showConsumption && (
              <div className="mt-1.5 flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <p className="text-xs text-emerald-700">{suggestion.description}</p>
                <button
                  onClick={applySuggestion}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 ml-2 flex-shrink-0"
                >
                  {t('pmodal_suggest_apply')}
                </button>
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">{t('pmodal_category')} *</label>
            {/* Top-level row */}
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {PANTRY_TOP_CATS.map((cat) => {
                const active = cat.value === 'food' ? isFoodFamily(category) : category === cat.value
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => {
                      if (cat.value === 'food') setCategory('food_other')
                      else setCategory(cat.value)
                    }}
                    className={`flex flex-col items-center gap-0.5 py-2 rounded-xl border text-xs font-medium transition-colors ${
                      active ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    <span className="text-lg">{cat.emoji}</span>
                    <span className="truncate text-[10px]">{catLabel(cat.value)}</span>
                  </button>
                )
              })}
            </div>
            {/* Food sub-category row */}
            {isFoodFamily(category) && (
              <div className="grid grid-cols-3 gap-1.5">
                {FOOD_SUBCATEGORIES.map((sub) => (
                  <button
                    key={sub.value}
                    type="button"
                    onClick={() => setCategory(sub.value)}
                    className={`flex items-center gap-1.5 px-2 py-2 rounded-xl border text-xs font-medium transition-colors ${
                      category === sub.value ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    <span>{sub.emoji}</span>
                    <span className="truncate">{catLabel(sub.value)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quantity + Unit */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-600 mb-1 block">{t('pmodal_quantity')}</label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={t('pmodal_qty_placeholder')}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div className="w-28">
              <label className="text-sm font-medium text-slate-600 mb-1 block">{t('pmodal_unit')}</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={t('pmodal_unit_placeholder')}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>

          {/* Expiry date */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">
              {t('pmodal_expiry')} <span className="text-slate-400 font-normal">{t('pmodal_expiry_optional')}</span>
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          {/* Consumption tracking */}
          <div>
            <button
              type="button"
              onClick={() => setShowConsumption(v => !v)}
              className="text-sm font-medium text-slate-500 hover:text-emerald-600 flex items-center gap-1.5 transition-colors"
            >
              <span className="text-xs">{showConsumption ? '▲' : '▼'}</span>
              {t('pmodal_consumption_label')}
            </button>

            {showConsumption && (
              <div className="mt-3 space-y-3 pl-1">
                {/* Lasts about X days */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600 w-28 flex-shrink-0">{t('pmodal_consumption_days')}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={consumptionDays}
                    onChange={e => setConsumptionDays(e.target.value)}
                    placeholder="45"
                    className="w-20 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <span className="text-sm text-slate-400">{t('pmodal_consumption_days_unit')}</span>
                </div>

                {/* Daily usage */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600 w-28 flex-shrink-0">{t('pmodal_daily_usage_label')}</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={dailyUsage}
                    onChange={e => setDailyUsage(e.target.value)}
                    placeholder="300"
                    className="w-20 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <input
                    type="text"
                    value={dailyUsageUnit}
                    onChange={e => setDailyUsageUnit(e.target.value)}
                    placeholder="g"
                    className="w-14 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>

                {/* Date opened */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600 w-28 flex-shrink-0">{t('pmodal_date_opened_label')}</label>
                  <input
                    type="date"
                    value={dateOpened}
                    onChange={e => setDateOpened(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-red-500 text-sm pb-2">{error}</p>}
        </div>

        <div className="flex-shrink-0 px-6 py-4 bg-white border-t border-slate-100 space-y-2">
          {/* Send to shopping list — edit mode only */}
          {editItem && (
            <button
              type="button"
              onClick={() => void sendToShopping()}
              disabled={sendingToShop || sentToShop}
              className="w-full py-3 border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold rounded-2xl text-sm hover:bg-emerald-100 active:bg-emerald-200 disabled:opacity-60 transition-colors"
            >
              {sentToShop ? t('pmodal_sent_to_shop') : sendingToShop ? '…' : `🛒 ${t('pmodal_send_to_shop')}`}
            </button>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold rounded-2xl text-base transition-colors"
          >
            {loading ? t('saving') : editItem ? t('pmodal_update_btn') : t('pmodal_save_btn')}
          </button>
        </div>

      </div>
    </div>
  )
}
