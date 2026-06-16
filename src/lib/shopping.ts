import { supabase } from './supabase'

function mergeQuantity(existing: string | null, incoming: string | null): string | null {
  if (!incoming) return existing
  if (!existing) return incoming
  const a = parseFloat(existing)
  const b = parseFloat(incoming)
  if (!isNaN(a) && !isNaN(b)) {
    const unit = existing.replace(/^[\d.]+\s*/, '').trim() || incoming.replace(/^[\d.]+\s*/, '').trim()
    const sum = Math.round((a + b) * 100) / 100
    return unit ? `${sum} ${unit}` : String(sum)
  }
  return `${existing} + ${incoming}`
}

export async function addToShoppingMerged(
  items: Array<{ name: string; quantity: string | null }>,
  householdId: string,
  addedBy: string | null,
  category = 'food',
) {
  if (items.length === 0) return

  const { data: existing } = await supabase
    .from('shopping_items')
    .select('id, name, quantity')
    .eq('household_id', householdId)
    .eq('is_ticked', false)

  // Map by lowercase name so lookups are case-insensitive
  const existingMap = new Map(
    (existing ?? []).map(i => [i.name.trim().toLowerCase(), i as { id: string; name: string; quantity: string | null }])
  )

  const toInsert: Array<{ name: string; quantity: string | null }> = []

  for (const item of items) {
    const key = item.name.trim().toLowerCase()
    const match = existingMap.get(key)
    if (match) {
      const merged = mergeQuantity(match.quantity, item.quantity)
      if (merged !== match.quantity) {
        await supabase.from('shopping_items').update({ quantity: merged }).eq('id', match.id)
        existingMap.set(key, { ...match, quantity: merged })
      }
    } else {
      toInsert.push(item)
      // Register so a second item with the same name in this batch merges rather than double-inserts
      existingMap.set(key, { id: '', name: item.name, quantity: item.quantity })
    }
  }

  if (toInsert.length > 0) {
    await supabase.from('shopping_items').insert(
      toInsert.map(item => ({
        name: item.name,
        quantity: item.quantity,
        category,
        is_ticked: false,
        household_id: householdId,
        added_by: addedBy,
      }))
    )
  }
}
