import { supabase } from './supabase'

interface IncomingItem {
  name: string
  pcs?: number | null
  amount_per_pack?: number | null
  unit?: string | null
  quantity?: string | null  // legacy text fallback
}

interface ExistingItem {
  id: string
  name: string
  pcs: number | null
  amount_per_pack: number | null
  unit: string | null
  quantity: string | null
}

function mergeStructured(existing: ExistingItem, incoming: IncomingItem): Record<string, unknown> | null {
  const ea = existing.amount_per_pack
  const ia = incoming.amount_per_pack ?? null
  const eu = existing.unit
  const iu = incoming.unit ?? null

  // Both have amount_per_pack with matching unit → merge
  if (ea && ia && eu === iu) {
    if (ea === ia) {
      // Same pack size → add pcs (e.g. 1 × 10 pc + 1 × 10 pc = 2 × 10 pc)
      return { pcs: (existing.pcs ?? 1) + (incoming.pcs ?? 1) }
    }
    // Different amounts, same unit → total them, clear pcs (e.g. 200g + 300g = 500g)
    return { amount_per_pack: Math.round((ea + ia) * 100) / 100, pcs: null }
  }

  // Only pcs, no amount → add pcs
  if (!ea && !ia && existing.pcs && (incoming.pcs ?? 0) > 0) {
    return { pcs: existing.pcs + (incoming.pcs ?? 1) }
  }

  // Legacy text merge
  const legacyQty = incoming.quantity ?? null
  if (legacyQty && existing.quantity) {
    const a = parseFloat(existing.quantity)
    const b = parseFloat(legacyQty)
    if (!isNaN(a) && !isNaN(b)) {
      return { quantity: String(Math.round((a + b) * 100) / 100) }
    }
  }

  return null  // cannot merge — leave existing unchanged
}

export async function addToShoppingMerged(
  items: IncomingItem[],
  householdId: string,
  addedBy: string | null,
  category = 'food',
) {
  if (items.length === 0) return

  const { data: existing } = await supabase
    .from('shopping_items')
    .select('id, name, pcs, amount_per_pack, unit, quantity')
    .eq('household_id', householdId)
    .eq('is_ticked', false)

  const existingMap = new Map(
    (existing ?? []).map(i => [i.name.trim().toLowerCase(), i as ExistingItem])
  )

  const toInsert: IncomingItem[] = []

  for (const item of items) {
    const key = item.name.trim().toLowerCase()
    const match = existingMap.get(key)

    if (match) {
      const update = mergeStructured(match, item)
      if (update) {
        await supabase.from('shopping_items').update(update).eq('id', match.id)
        // Update local map so a second item in the same batch merges onto the updated values
        existingMap.set(key, { ...match, ...update } as ExistingItem)
      }
    } else {
      toInsert.push(item)
      existingMap.set(key, {
        id: '',
        name: item.name,
        pcs: item.pcs ?? null,
        amount_per_pack: item.amount_per_pack ?? null,
        unit: item.unit ?? null,
        quantity: item.quantity ?? null,
      })
    }
  }

  if (toInsert.length > 0) {
    await supabase.from('shopping_items').insert(
      toInsert.map(item => ({
        name: item.name,
        pcs: item.pcs ?? null,
        amount_per_pack: item.amount_per_pack ?? null,
        unit: item.unit ?? null,
        quantity: item.quantity ?? null,
        category,
        is_ticked: false,
        household_id: householdId,
        added_by: addedBy,
      }))
    )
  }
}
