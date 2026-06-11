'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { CATEGORIES } from '@/lib/categories'
import { useT, useCatLabel } from '@/lib/i18n'

interface Props {
  onClose: () => void
  onAdded: () => void
}

export default function AddShoppingItemModal({ onClose, onAdded }: Props) {
  const { profile } = useAuth()
  const t = useT()
  const catLabel = useCatLabel()
  const [name, setName]         = useState('')
  const [quantity, setQuantity] = useState('')
  const [category, setCategory] = useState('other')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function handleAdd() {
    if (!name.trim()) { setError('Please enter an item name'); return }
    setSaving(true)
    const { error: dbErr } = await supabase.from('shopping_items').insert({
      name: name.trim(),
      quantity: quantity.trim() || null,
      category,
      is_ticked: false,
      household_id: profile?.household_id,
      added_by: profile?.display_name,
    })
    setSaving(false)
    if (dbErr) { setError('Could not save item. Please try again.'); return }
    onAdded()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-3xl flex flex-col"
        style={{ maxHeight: '85dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-4 pt-2 pb-3 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">{t('smodal_title')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">{t('smodal_name')} *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
              placeholder="e.g. Milk, Bread, Shampoo…"
              className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-base focus:outline-none focus:border-emerald-400"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">
              {t('smodal_qty')} <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 2, 1 bottle, 500g…"
              className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-base focus:outline-none focus:border-emerald-400"
            />
          </div>

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
            onClick={handleAdd}
            disabled={saving}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-2xl text-base transition-colors shadow-sm"
          >
            {saving ? t('saving') : t('smodal_add_btn')}
          </button>
        </div>
      </div>
    </div>
  )
}
