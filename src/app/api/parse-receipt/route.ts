import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a grocery receipt parser. Extract all product items from the receipt.

Baltic/Estonian receipts often show a quantity multiplier line directly below the product name, in the format:
  4,000 tk. X 1,29
This means 4 pieces were bought at 1.29 each. The number uses a comma as the decimal separator (so "4,000 tk." = 4 pieces, "2,000 tk." = 2 pieces). When this multiplier line is present, use the piece count as quantity and "pcs" as unit — do NOT use the pack weight from the product name as the quantity.

SKIP (do not output as items) any line that is:
- A discount/markdown adjustment: lines containing "Allah.", "Allahindlus", "Uus hind", or any line with a negative price that is not a standalone product
- A loyalty/campaign section header: "SINU SOODUSTUSED", "Kampaania", "Boonuspunktid"
- A receipt total, subtotal, VAT, or payment line: "KOKKU", "KM", "KAARDIMAKSEGA", "SULARAHA", "TAGASTUS", "JÄÄK", or any line that is clearly a monetary total rather than a purchased item
- An item code, barcode row, or cashier/store metadata line

For each item return:
- name: clean product name (no prices, quantities in the name, or item codes)
- category: exactly one of these values:
    Food sub-categories: "food_veg" (vegetables, fruit), "food_dairy" (milk, cheese, eggs, yogurt, butter), "food_meat" (meat, poultry, fish, seafood, deli), "food_dry" (pasta, rice, flour, oil, canned goods, sauces, condiments), "food_frozen" (ice cream, frozen pizza, frozen veg), "food_bread" (bread, rolls, pastry, bakery), "food_snacks" (chips, chocolate, sweets, nuts, candy, biscuits, wafers), "food_drinks" (juice, water, beer, wine, soft drinks, coffee, tea), "food_other" (any other food item that doesn't fit above)
    Other: "household" (cleaning, paper, kitchen supplies), "personal" (shampoo, cosmetics, hygiene, beauty), "medicine" (pharmacy, supplements), "pets" (pet food, pet supplies)
- quantity: if a "X,000 tk." multiplier line is present → that integer count as a string (e.g. "4"); otherwise the numeric amount from the product name as a string; otherwise null
- unit: if a "X,000 tk." multiplier line is present → "pcs"; otherwise unit like "g", "kg", "L", "ml", "pcs", "bottle", "pack" — or null
- price: the total line price for this item as a number (not unit price), or null if not visible
- estimated_expiry_days: integer — estimated days from purchase until the item typically expires when refrigerated. Use these EU averages: milk 7, chicken/poultry 2, raw beef/pork/mince 3, vegetables 5, yogurt/kefir 14, hard cheese (cheddar/gouda) 21, soft cheese (mozzarella/brie/cream cheese/feta) 7, eggs 21, bread 5. For canned goods, dry pasta, rice, cleaning products, cosmetics, and other non-perishables return null.

Return ONLY valid JSON, no other text:
{"items":[{"name":"Pasta","category":"food","quantity":"500","unit":"g","price":1.29,"estimated_expiry_days":null}]}`

const LANGUAGE_INSTRUCTION: Record<string, string> = {
  en: 'IMPORTANT: All item names must be in English. Translate every descriptive word in the product name to English, regardless of the receipt language. For example "hakkliha" → "mince meat", "piim" → "milk", "punane paprika" → "red pepper". Keep only proper brand names (e.g. Leibur, Fazer, KitKat, Macetti) unchanged.',
  et: 'IMPORTANT: All item names must be in Estonian (eesti keel). Translate every descriptive word in the product name to Estonian. Keep brand names (manufacturer or product brand) unchanged.',
  ru: 'IMPORTANT: All item names must be in Russian (на русском языке). Translate EVERY descriptive word — including adjectives, colours, and food types — into Russian. For example "punane paprika" → "красный перец", "leib rukkipala" → "хлеб ржаной". Keep only proper brand names (e.g. Leibur, Fazer, KitKat, Macetti) unchanged. Do not leave any Estonian or other non-Russian words in the output except brand names.',
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { type, data, mediaType, language } = body as {
    type: 'image' | 'pdf' | 'text'
    data: string
    mediaType?: string
    language?: string
  }

  const langNote = language && LANGUAGE_INSTRUCTION[language] ? `\n\n${LANGUAGE_INSTRUCTION[language]}` : ''
  const systemPrompt = SYSTEM_PROMPT + langNote

  let content: Anthropic.Messages.MessageParam['content']

  if (type === 'pdf') {
    content = [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data,
        },
        title: null,
      },
      { type: 'text', text: 'Parse this receipt and list every product.' },
    ]
  } else if (type === 'image') {
    content = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: (mediaType ?? 'image/jpeg') as Anthropic.Messages.Base64ImageSource['media_type'],
          data,
        },
      },
      { type: 'text', text: 'Parse this receipt and list every product.' },
    ]
  } else {
    content = `Parse this receipt text and list every product:\n\n${data}`
  }

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 8096,
    system: systemPrompt,
    messages: [{ role: 'user', content }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  // Claude may wrap JSON in a code block — strip it
  const cleaned = text.replace(/```(?:json)?\n?/g, '').trim()

  try {
    const parsed = JSON.parse(cleaned)
    return NextResponse.json(parsed)
  } catch {
    console.error('Parse-receipt raw response:', text)
    return NextResponse.json({ error: `Could not parse AI response: ${text.slice(0, 300)}` }, { status: 500 })
  }
}
