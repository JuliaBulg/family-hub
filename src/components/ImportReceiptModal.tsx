'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { CATEGORIES, FOOD_SUBCATEGORIES, type Category, isFoodFamily } from '@/lib/categories'
import { useCatLabel, useT } from '@/lib/i18n'

type Step = 'input' | 'parsing' | 'review' | 'expense'
type Tab  = 'photo' | 'text'

interface ParsedItem {
  name: string
  category: Category
  quantity: string | null
  unit: string | null
  price: number | null
  estimated_expiry_days: number | null
}

interface Props {
  onClose: () => void
  onAdded: () => void
}

export default function ImportReceiptModal({ onClose, onAdded }: Props) {
  const { profile } = useAuth()
  const catLabel = useCatLabel()
  const t = useT()

  const [step, setStep]                 = useState<Step>('input')
  const [tab, setTab]                   = useState<Tab>('photo')
  const [imageFile, setImageFile]       = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [textInput, setTextInput]       = useState('')
  const [parsedItems, setParsedItems]   = useState<ParsedItem[]>([])
  const [selected, setSelected]         = useState<Set<number>>(new Set())
  const [error, setError]               = useState('')
  const [saving, setSaving]             = useState(false)

  const [expAmounts, setExpAmounts]     = useState<Partial<Record<Category, string>>>({})
  const [expCategories, setExpCategories] = useState<Category[]>([])
  const [expStore, setExpStore]         = useState('')
  const [expSaving, setExpSaving]       = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleParse() {
    setError('')
    setStep('parsing')
    try {
      let body: object
      if (tab === 'photo') {
        if (!imageFile) { setStep('input'); setError(t('receipt_error_no_file')); return }
        const isPdf = imageFile.type === 'application/pdf'
        body = {
          type: isPdf ? 'pdf' : 'image',
          data: imagePreview.split(',')[1],
          mediaType: imageFile.type,
        }
      } else {
        if (!textInput.trim()) { setStep('input'); setError(t('receipt_error_no_text')); return }
        body = { type: 'text', data: textInput }
      }

      const res = await fetch('/api/parse-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, language: profile?.language ?? 'en' }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Server error') }

      const json = await res.json()
      const validValues = new Set([
        ...CATEGORIES.map(c => c.value),
        ...FOOD_SUBCATEGORIES.map(s => s.value),
      ])
      const items: ParsedItem[] = (json.items ?? []).map((i: ParsedItem) => ({
        name: i.name,
        category: validValues.has(i.category) ? i.category : ('food_other' as Category),
        quantity: i.quantity ?? null,
        unit: i.unit ?? null,
        price: typeof i.price === 'number' ? i.price : null,
        estimated_expiry_days: typeof i.estimated_expiry_days === 'number' ? i.estimated_expiry_days : null,
      }))
      setParsedItems(items)
      setSelected(new Set(items.map((_, idx) => idx)))
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setStep('input')
    }
  }

  function toggleItem(idx: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  function updateCategory(idx: number, cat: Category) {
    setParsedItems(prev => prev.map((item, i) => i === idx ? { ...item, category: cat } : item))
  }

  function updateName(idx: number, name: string) {
    setParsedItems(prev => prev.map((item, i) => i === idx ? { ...item, name } : item))
  }

  async function handleAddSelected() {
    const toAdd = parsedItems.filter((_, idx) => selected.has(idx))
    if (toAdd.length === 0) return
    setSaving(true)

    const today = new Date()
    let insertError: string | null = null

    for (const item of toAdd) {
      const expiryDate: string | null = (() => {
        if (item.estimated_expiry_days == null) return null
        const d = new Date(today)
        d.setDate(d.getDate() + item.estimated_expiry_days)
        return d.toISOString().split('T')[0]
      })()

      const trimmedName = item.name.trim()

      const { data } = expiryDate === null
        ? await supabase.from('pantry_items').select('id, quantity, unit').ilike('name', trimmedName).eq('category', item.category).is('expiry_date', null).limit(1)
        : await supabase.from('pantry_items').select('id, quantity, unit').ilike('name', trimmedName).eq('category', item.category).eq('expiry_date', expiryDate).limit(1)

      const existing = data?.[0]
      if (existing) {
        const eQty = parseFloat(existing.quantity ?? 'NaN')
        const nQty = parseFloat(item.quantity ?? 'NaN')
        if (!isNaN(eQty) && !isNaN(nQty) && existing.unit === item.unit) {
          const { error } = await supabase.from('pantry_items').update({ quantity: String(eQty + nQty) }).eq('id', existing.id)
          if (error) { insertError = error.message; break }
          continue
        }
      }

      const { error } = await supabase.from('pantry_items').insert({
        name: trimmedName,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        expiry_date: expiryDate,
        household_id: profile?.household_id,
        added_by: profile?.display_name,
      })
      if (error) { insertError = error.message; break }
    }

    setSaving(false)
    if (insertError) { setError(t('receipt_error_save')); return }

    // Roll food sub-categories up to 'food' for expense grouping
    const expBucket = (cat: Category): Category => isFoodFamily(cat) ? 'food' : cat
    const totals: Partial<Record<Category, number>> = {}
    toAdd.forEach(item => {
      if (item.price != null) {
        const bucket = expBucket(item.category)
        totals[bucket] = (totals[bucket] ?? 0) + item.price
      }
    })

    const cats = [...new Set(toAdd.map(i => expBucket(i.category)))] as Category[]
    setExpCategories(cats)
    setExpAmounts(
      Object.fromEntries(
        cats.map(c => [c, totals[c] != null ? totals[c]!.toFixed(2) : ''])
      ) as Partial<Record<Category, string>>
    )

    onAdded()
    setStep('expense')
  }

  async function handleLogExpenses() {
    const today = new Date().toISOString().split('T')[0]
    const rows = expCategories
      .map(cat => ({ cat, amount: parseFloat((expAmounts[cat] ?? '').replace(',', '.')) }))
      .filter(r => !isNaN(r.amount) && r.amount > 0)
      .map(r => ({
        household_id: profile?.household_id,
        amount: r.amount,
        category: r.cat,
        store: expStore.trim() || null,
        date: today,
        added_by: profile?.display_name,
      }))

    if (rows.length === 0) { onClose(); return }

    setExpSaving(true)
    const { error: dbError } = await supabase.from('expenses').insert(rows)
    setExpSaving(false)
    if (dbError) { setError(`Could not save expenses: ${dbError.message}`); return }
    onClose()
  }

  const selectedCount = selected.size
  const hasAnyExpAmount = expCategories.some(c => {
    const v = parseFloat((expAmounts[c] ?? '').replace(',', '.'))
    return !isNaN(v) && v > 0
  })

  const subtitle =
    step === 'review'  ? t('receipt_subtitle_review').replace('{n}', String(parsedItems.length)) :
    step === 'expense' ? t('receipt_subtitle_expense') :
                         t('receipt_subtitle_input')

  return (
    <div className="fixed inset-0 bg-black/40 z-[200] flex items-start justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-b-3xl flex flex-col"
        style={{ height: '100dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-8 pb-3 flex items-center gap-3">
          {step === 'review' && (
            <button onClick={() => setStep('input')} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">‹</button>
          )}
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-800">
              {step === 'expense' ? t('receipt_title_expense') : t('receipt_title')}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-scroll px-6 pb-4">

          {/* INPUT / PARSING */}
          {(step === 'input' || step === 'parsing') && (
            <div className="space-y-4">
              <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
                {(['photo', 'text'] as Tab[]).map(tabKey => (
                  <button key={tabKey} onClick={() => setTab(tabKey)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${tab === tabKey ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                  >
                    {tabKey === 'photo' ? t('receipt_tab_photo') : t('receipt_tab_text')}
                  </button>
                ))}
              </div>

              {tab === 'photo' && (
                <div>
                  <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
                  {imageFile ? (
                    <div className="relative">
                      {imageFile.type === 'application/pdf' ? (
                        <div className="w-full h-28 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-4 px-5">
                          <span className="text-4xl">📄</span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-700 truncate">{imageFile.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{(imageFile.size / 1024).toFixed(0)} KB · PDF</p>
                          </div>
                        </div>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={imagePreview} alt="Receipt preview" className="w-full rounded-2xl object-cover max-h-64" />
                      )}
                      <button onClick={() => { setImageFile(null); setImagePreview('') }} className="absolute top-2 right-2 bg-white/80 rounded-full w-7 h-7 flex items-center justify-center text-slate-500 text-sm shadow">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current?.click()}
                      className="w-full h-40 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-emerald-300 hover:text-emerald-500 transition-colors"
                    >
                      <span className="text-4xl">📷</span>
                      <span className="text-sm font-medium">{t('receipt_upload_prompt')}</span>
                    </button>
                  )}
                </div>
              )}

              {tab === 'text' && (
                <textarea
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  placeholder={"Paste your receipt text here…\n\ne.g.\nSpaghetti 500g  €1.29\nTomato sauce 400g  €0.89\nShampoo 250ml  €3.49"}
                  rows={10}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                />
              )}

              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>
          )}

          {/* REVIEW */}
          {step === 'review' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1">
                <button onClick={() => setSelected(new Set(parsedItems.map((_, i) => i)))} className="text-xs text-emerald-600 font-medium">{t('receipt_select_all')}</button>
                <button onClick={() => setSelected(new Set())} className="text-xs text-slate-400">{t('receipt_deselect_all')}</button>
              </div>

              {parsedItems.map((item, idx) => {
                const isChecked = selected.has(idx)
                return (
                  <div key={idx} className={`rounded-2xl border p-3 transition-colors ${isChecked ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-100 bg-white opacity-60'}`}>
                    <div className="flex items-start gap-3">
                      <button onClick={() => toggleItem(idx)}
                        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isChecked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}
                      >
                        {isChecked && <span className="text-[10px] font-bold">✓</span>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            value={item.name}
                            onChange={e => updateName(idx, e.target.value)}
                            className="flex-1 bg-transparent font-medium text-slate-800 text-sm focus:outline-none border-b border-transparent focus:border-slate-300 pb-0.5 min-w-0"
                          />
                          {item.price != null && (
                            <span className="text-xs font-semibold text-slate-500 flex-shrink-0">€{item.price.toFixed(2)}</span>
                          )}
                        </div>
                        {(item.quantity || item.unit) && (
                          <p className="text-xs text-slate-400 mt-0.5">{item.quantity}{item.unit ? ` ${item.unit}` : ''}</p>
                        )}
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {FOOD_SUBCATEGORIES.map(c => (
                            <button key={c.value} onClick={() => updateCategory(idx, c.value)}
                              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${item.category === c.value ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}
                            >
                              {c.emoji} {catLabel(c.value)}
                            </button>
                          ))}
                          {CATEGORIES.filter(c => !['food','drinks','other'].includes(c.value)).map(c => (
                            <button key={c.value} onClick={() => updateCategory(idx, c.value)}
                              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${item.category === c.value ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}
                            >
                              {c.emoji} {catLabel(c.value)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>
          )}

          {/* EXPENSE */}
          {step === 'expense' && (
            <div className="space-y-4 pt-2">
              <p className="text-xs text-slate-400">{t('receipt_expense_hint')}</p>

              {expCategories.map(catValue => {
                const cat = CATEGORIES.find(c => c.value === catValue) ?? CATEGORIES[0]!
                return (
                  <div key={catValue} className="flex items-center gap-3">
                    <span className="text-xl flex-shrink-0">{cat.emoji}</span>
                    <p className="flex-1 text-sm font-medium text-slate-700 truncate">{catLabel(cat.value)}</p>
                    <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden w-28 flex-shrink-0">
                      <span className="px-2 text-slate-400 text-sm">€</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={expAmounts[catValue] ?? ''}
                        onChange={e => setExpAmounts(prev => ({ ...prev, [catValue]: e.target.value }))}
                        placeholder="0.00"
                        className="w-full py-2.5 pr-2 text-sm text-slate-800 focus:outline-none bg-white"
                      />
                    </div>
                  </div>
                )
              })}

              <div className="pt-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('exp_modal_store')} <span className="text-slate-400 font-normal">{t('exp_modal_optional')}</span>
                </label>
                <input
                  type="text"
                  value={expStore}
                  onChange={e => setExpStore(e.target.value)}
                  placeholder="e.g. Rimi, Maxima…"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                />
              </div>

              {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 bg-white border-t border-slate-100">
          {step === 'input' && (
            <button onClick={() => void handleParse()} disabled={tab === 'photo' ? !imagePreview : !textInput.trim()}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold rounded-2xl text-base transition-colors"
            >
              {t('receipt_parse_btn')}
            </button>
          )}
          {step === 'parsing' && (
            <div className="w-full py-4 bg-slate-100 rounded-2xl flex flex-col items-center justify-center gap-1">
              <span className="text-slate-500 text-sm animate-pulse">
                {imageFile?.type === 'application/pdf' ? t('receipt_reading_pdf') : t('receipt_analysing')}
              </span>
              {imageFile?.type === 'application/pdf' && (
                <span className="text-slate-400 text-xs">{t('receipt_pdf_wait')}</span>
              )}
            </div>
          )}
          {step === 'review' && (
            <button onClick={() => void handleAddSelected()} disabled={selectedCount === 0 || saving}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold rounded-2xl text-base transition-colors"
            >
              {saving
                ? t('receipt_saving')
                : t('receipt_add_btn').replace('{n}', String(selectedCount)).replace('{s}', selectedCount !== 1 ? 's' : '')}
            </button>
          )}
          {step === 'expense' && (
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-4 border border-slate-200 text-slate-600 font-semibold rounded-2xl text-base hover:bg-slate-50 transition-colors"
              >
                {t('receipt_skip')}
              </button>
              <button onClick={() => void handleLogExpenses()} disabled={expSaving || !hasAnyExpAmount}
                className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold rounded-2xl text-base transition-colors"
              >
                {expSaving ? t('receipt_saving') : t('receipt_log_btn')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
