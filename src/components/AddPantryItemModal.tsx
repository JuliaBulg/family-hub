'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type Category = 'food' | 'household' | 'drinks' | 'personal' | 'medicine' | 'pets' | 'other'

const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: 'food',      label: 'Food & Groceries',    emoji: '🛒' },
  { value: 'drinks',    label: 'Drinks & Extras',      emoji: '🥤' },
  { value: 'household', label: 'Household',            emoji: '🧹' },
  { value: 'personal',  label: 'Personal & Cosmetics', emoji: '🧴' },
  { value: 'medicine',  label: 'Medicine & First Aid', emoji: '💊' },
  { value: 'pets',      label: 'Pets & Animals',       emoji: '🐾' },
  { value: 'other',     label: 'Everything Else',      emoji: '🧺' },
]

interface EditItem {
  id: string
  name: string
  category: Category
  quantity: string | null
  unit: string | null
  expiry_date: string | null
}

interface Props {
  onClose: () => void
  onAdded: () => void
  editItem?: EditItem
}

export default function AddPantryItemModal({ onClose, onAdded, editItem }: Props) {
  const { profile } = useAuth()
  const [name, setName]           = useState(editItem?.name ?? '')
  const [category, setCategory]   = useState<Category>(editItem?.category ?? 'food')
  const [quantity, setQuantity]   = useState(editItem?.quantity ?? '')
  const [unit, setUnit]           = useState(editItem?.unit ?? '')
  const [expiryDate, setExpiryDate] = useState(editItem?.expiry_date ?? '')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  async function handleSubmit() {
    if (!name.trim()) return
    setLoading(true)
    setError('')

    const payload = {
      name: name.trim(),
      category,
      quantity: quantity.trim() || null,
      unit: unit.trim() || null,
      expiry_date: expiryDate || null,
    }

    const { error: dbErr } = editItem
      ? await supabase.from('pantry_items').update(payload).eq('id', editItem.id)
      : await supabase.from('pantry_items').insert({
          ...payload,
          household_id: profile?.household_id,
          added_by: profile?.display_name,
        })

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

        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-8 pb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">{editItem ? 'Edit Item' : 'Add to Pantry'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">✕</button>
        </div>

        {/* Form fields */}
        <div className="flex-1 min-h-0 overflow-y-scroll px-6 space-y-4 pb-4">

          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Item name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pasta, Milk, Shampoo…"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Category *</label>
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
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-600 mb-1 block">Quantity</label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 2, 500"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div className="w-28">
              <label className="text-sm font-medium text-slate-600 mb-1 block">Unit</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="g, L, pcs"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Expiry date (optional)</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          {error && <p className="text-red-500 text-sm pb-2">{error}</p>}

        </div>

        {/* Pinned button */}
        <div className="flex-shrink-0 px-6 py-4 bg-white border-t border-slate-100">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold rounded-2xl text-base transition-colors"
          >
            {loading ? 'Saving…' : editItem ? '✅ Save Changes' : '✅ Add to Pantry'}
          </button>
        </div>

      </div>
    </div>
  )
}
