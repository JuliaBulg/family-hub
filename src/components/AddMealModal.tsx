'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type Slot = 'breakfast' | 'lunch' | 'dinner'

interface Meal {
  id: string
  date: string
  slot: Slot
  name: string
  servings: number
}

interface Props {
  date: string
  meal?: Meal
  onClose: () => void
  onSaved: () => void
}

const SLOTS: { value: Slot; label: string; emoji: string }[] = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { value: 'lunch',     label: 'Lunch',     emoji: '☀️'  },
  { value: 'dinner',    label: 'Dinner',    emoji: '🌙' },
]

export default function AddMealModal({ date, meal, onClose, onSaved }: Props) {
  const { profile } = useAuth()
  const [mealDate, setMealDate] = useState(meal?.date ?? date)
  const [slot, setSlot]         = useState<Slot>(meal?.slot ?? 'dinner')
  const [name, setName]         = useState(meal?.name ?? '')
  const [servings, setServings] = useState(meal?.servings ?? 2)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit() {
    if (!name.trim()) return
    setLoading(true)
    setError('')

    const payload = { date: mealDate, slot, name: name.trim(), servings }

    const { error: dbErr } = meal
      ? await supabase.from('meals').update(payload).eq('id', meal.id)
      : await supabase.from('meals').insert({
          ...payload,
          household_id: profile?.household_id,
          added_by: profile?.display_name,
        })

    setLoading(false)
    if (dbErr) { setError('Something went wrong. Please try again.'); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[200] flex items-start justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-b-3xl flex flex-col"
        style={{ maxHeight: '90dvh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-6 pt-8 pb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">{meal ? 'Edit Meal' : 'Add Meal'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 space-y-5 pb-4">

          {/* Date */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Date</label>
            <input
              type="date"
              value={mealDate}
              onChange={e => setMealDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          {/* Slot */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-2 block">Meal slot</label>
            <div className="grid grid-cols-3 gap-2">
              {SLOTS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setSlot(s.value)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                    slot === s.value
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <span className="text-xl">{s.emoji}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Meal name */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Meal name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Pasta Bolognese, Chicken soup…"
              autoFocus={!meal}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          {/* Servings */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-2 block">Servings</label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setServings(s => Math.max(1, s - 1))}
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xl font-semibold transition-colors"
              >
                −
              </button>
              <span className="text-2xl font-bold text-slate-800 w-8 text-center">{servings}</span>
              <button
                onClick={() => setServings(s => Math.min(12, s + 1))}
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xl font-semibold transition-colors"
              >
                +
              </button>
              <span className="text-sm text-slate-400">people</span>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100">
          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-semibold rounded-2xl text-base transition-colors"
          >
            {loading ? 'Saving…' : meal ? '✅ Save Changes' : '✅ Add Meal'}
          </button>
        </div>
      </div>
    </div>
  )
}
