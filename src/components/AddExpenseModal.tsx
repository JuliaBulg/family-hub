'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { CATEGORIES, type Category } from '@/lib/categories'
import { useCatLabel, useT } from '@/lib/i18n'

interface Props {
  onClose: () => void
  onAdded: () => void
}

export default function AddExpenseModal({ onClose, onAdded }: Props) {
  const { profile } = useAuth()
  const catLabel = useCatLabel()
  const t = useT()
  const [amount, setAmount]       = useState('')
  const [category, setCategory]   = useState<Category | null>(null)
  const [store, setStore]         = useState('')
  const [note, setNote]           = useState('')
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  async function submit() {
    if (!category || !amount) return
    const parsed = parseFloat(amount.replace(',', '.'))
    if (isNaN(parsed) || parsed <= 0) { setError(t('exp_modal_invalid_amount')); return }

    setLoading(true)
    const { error: dbError } = await supabase.from('expenses').insert({
      household_id: profile?.household_id,
      amount: parsed,
      category,
      store: store.trim() || null,
      note: note.trim() || null,
      date,
      added_by: profile?.display_name,
    })

    if (dbError) { setError(dbError.message); setLoading(false); return }
    onAdded()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-700">{t('exp_modal_title')}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('exp_modal_amount')}</label>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('exp_modal_category')}</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
                    category === cat.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span className="truncate">{catLabel(cat.value)}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('exp_modal_store')} <span className="text-slate-400 font-normal">{t('exp_modal_optional')}</span>
            </label>
            <input
              type="text"
              value={store}
              onChange={e => setStore(e.target.value)}
              placeholder="e.g. Rimi, Maxima…"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('exp_modal_note')} <span className="text-slate-400 font-normal">{t('exp_modal_optional')}</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Weekly groceries"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('exp_modal_date')}</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
          )}

          <button
            onClick={() => void submit()}
            disabled={loading || !category || !amount}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
          >
            {loading ? t('exp_modal_saving') : t('exp_modal_save')}
          </button>
        </div>
      </div>
    </div>
  )
}
