'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { CATEGORIES } from '@/lib/categories'
import AddExpenseModal from '@/components/AddExpenseModal'
import { useT, useCatLabel } from '@/lib/i18n'

interface Expense {
  id: string
  amount: number
  category: string
  store: string | null
  note: string | null
  date: string
  added_by: string | null
}

function formatMonth(year: number, month: number) {
  return new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })
}

export default function ExpensesPage() {
  const { profile } = useAuth()
  const t = useT()
  const catLabel = useCatLabel()
  const now = new Date()
  const [year, setYear]           = useState(now.getFullYear())
  const [month, setMonth]         = useState(now.getMonth())
  const [expenses, setExpenses]   = useState<Expense[]>([])
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const fetchExpenses = useCallback(async () => {
    if (!profile?.household_id) return
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const to   = new Date(year, month + 1, 0).toISOString().split('T')[0]
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('household_id', profile.household_id)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false })
    setExpenses(data ?? [])
  }, [year, month, profile?.household_id])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setExpanded(null)
  }

  function nextMonth() {
    const next = new Date(year, month + 1)
    if (next > now) return
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setExpanded(null)
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const maxCategoryTotal = Math.max(
    ...CATEGORIES.map(cat => expenses.filter(e => e.category === cat.value).reduce((s, e) => s + Number(e.amount), 0)),
    1
  )

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 px-4 pt-4 pb-24">

        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 text-lg hover:bg-slate-200 active:bg-slate-300 transition-colors">
            ‹
          </button>
          <h1 className="text-base font-semibold text-slate-700">{formatMonth(year, month)}</h1>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 text-lg hover:bg-slate-200 active:bg-slate-300 transition-colors disabled:opacity-30"
          >
            ›
          </button>
        </div>

        <div className="p-5 bg-emerald-500 text-white rounded-2xl shadow-md mb-5">
          <p className="text-sm opacity-80 mb-1">{t('exp_total')} this month</p>
          <p className="text-4xl font-bold">€{total.toFixed(2)}</p>
          <p className="text-xs opacity-70 mt-1">{expenses.length} expense{expenses.length !== 1 ? 's' : ''} logged</p>
        </div>

        <div className="space-y-2">
          {CATEGORIES.map(cat => {
            const catExpenses = expenses.filter(e => e.category === cat.value)
            const catTotal    = catExpenses.reduce((s, e) => s + Number(e.amount), 0)
            const barWidth    = catTotal > 0 ? Math.max((catTotal / maxCategoryTotal) * 100, 6) : 0
            const isOpen      = expanded === cat.value

            if (catTotal === 0) return null
            return (
              <div key={cat.value} className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setExpanded(isOpen ? null : cat.value)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                >
                  <span className="text-xl flex-shrink-0">{cat.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium text-slate-700">{catLabel(cat.value)}</p>
                      <p className={`text-sm font-semibold ml-2 flex-shrink-0 ${catTotal > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                        €{catTotal.toFixed(2)}
                      </p>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                  <span className={`text-slate-400 text-sm flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>›</span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100">
                    {catExpenses.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-400">{t('exp_empty')}</p>
                    ) : (
                      catExpenses.map(e => (
                        <div key={e.id} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-50 last:border-b-0">
                          <div className="min-w-0">
                            <p className="text-sm text-slate-700 truncate">
                              {e.note ?? e.store ?? catLabel(cat.value)}
                            </p>
                            <p className="text-xs text-slate-400">
                              {[e.store, e.date, e.added_by ? `by ${e.added_by}` : null].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-slate-700 ml-3 flex-shrink-0">€{Number(e.amount).toFixed(2)}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="sticky bottom-0 px-4 pt-2 pb-3 border-t border-slate-100 bg-slate-50">
        <button
          onClick={() => setShowModal(true)}
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
        >
          {t('exp_add')} expense
        </button>
      </div>

      {showModal && (
        <AddExpenseModal onClose={() => setShowModal(false)} onAdded={fetchExpenses} />
      )}
    </div>
  )
}
