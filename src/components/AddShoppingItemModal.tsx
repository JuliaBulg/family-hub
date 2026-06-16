'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { CATEGORIES } from '@/lib/categories'
import { useT, useCatLabel } from '@/lib/i18n'

const UNITS = ['g', 'kg', 'mL', 'L', 'pc', 'pack', 'box']

interface ShoppingItem {
  id: string
  name: string
  pcs: number | null
  amount_per_pack: number | null
  unit: string | null
  category: string | null
}

interface Props {
  onClose: () => void
  onAdded: () => void
  item?: ShoppingItem
}

export default function AddShoppingItemModal({ onClose, onAdded, item }: Props) {
  const { profile } = useAuth()
  const t = useT()
  const catLabel = useCatLabel()
  const isEdit = !!item

  const [name, setName]           = useState(item?.name ?? '')
  const [pcs, setPcs]             = useState(item?.pcs != null ? String(item.pcs) : '')
  const [amount, setAmount]       = useState(item?.amount_per_pack != null ? String(item.amount_per_pack) : '')
  const [unit, setUnit]           = useState(item?.unit ?? '')
  const [category, setCategory]   = useState(item?.category ?? 'other')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  function toggleUnit(u: string) {
    setUnit(prev => prev === u ? '' : u)
  }

  async function handleSave() {
    if (!name.trim()) { setError('Please enter an item name'); return }
    setSaving(true)

    const payload = {
      name: name.trim(),
      pcs: pcs ? parseInt(pcs) : null,
      amount_per_pack: amount ? parseFloat(amount) : null,
      unit: unit || null,
      category,
    }

    if (isEdit) {
      const { error: dbErr } = await supabase
        .from('shopping_items')
        .update(payload)
        .eq('id', item.id)
      setSaving(false)
      if (dbErr) { setError('Could not save item. Please try again.'); return }
    } else {
      const { error: dbErr } = await supabase.from('shopping_items').insert({
        ...payload,
        is_ticked: false,
        household_id: profile?.household_id,
        added_by: profile?.display_name,
      })
      setSaving(false)
      if (dbErr) { setError('Could not save item. Please try again.'); return }
    }
    onAdded()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-3xl flex flex-col"
        style={{ maxHeight: '90dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-4 pt-2 pb-3 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">
            {isEdit ? t('smodal_edit_title') : t('smodal_title')}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">{t('smodal_name')} *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
              placeholder="e.g. Eggs, Milk, Shampoo…"
              className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-base focus:outline-none focus:border-emerald-400"
              autoFocus
            />
          </div>

          {/* Pcs + Amount side by side */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-600 mb-1">
                {t('smodal_pcs')} <span className="font-normal text-slate-400 text-xs">(opt)</span>
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={pcs}
                onChange={(e) => setPcs(e.target.value)}
                placeholder="1"
                min="1"
                className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-base focus:outline-none focus:border-emerald-400"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-600 mb-1">
                {t('smodal_amount')} <span className="font-normal text-slate-400 text-xs">(opt)</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="400"
                min="0"
                className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-base focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          {/* Unit pills */}
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-2">
              {t('smodal_unit')} <span className="font-normal text-slate-400 text-xs">(opt)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {UNITS.map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => toggleUnit(u)}
                  className={`px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors ${
                    unit === u
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">{t('pmodal_category')}</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    category === cat.value
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span className="truncate">{catLabel(cat.value)}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <div className="px-4 py-4 border-t border-slate-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-2xl text-base transition-colors shadow-sm"
          >
            {saving ? t('saving') : isEdit ? t('btn_save') : t('smodal_add_btn')}
          </button>
        </div>
      </div>
    </div>
  )
}
