import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a cooking assistant. Given a meal name and number of servings, list the key ingredients needed.
Focus on main ingredients only (4–8 items). Skip generic spices, oil, salt, and pepper.
Return ONLY valid JSON, no other text:
{"ingredients":[{"name":"pasta","quantity":"400","unit":"g"},{"name":"mince meat","quantity":"500","unit":"g"}]}`

const LANGUAGE_INSTRUCTION: Record<string, string> = {
  et: 'IMPORTANT: All ingredient names must be in Estonian (eesti keel).',
  ru: 'IMPORTANT: All ingredient names must be in Russian (на русском языке).',
}

export async function POST(req: NextRequest) {
  const { mealName, servings = 4, pantryItems = [], language = 'en' } = await req.json() as {
    mealName: string
    servings?: number
    pantryItems?: { id: string; name: string }[]
    language?: string
  }

  const languageNote = LANGUAGE_INSTRUCTION[language] ?? ''
  const userContent  = [`Meal: ${mealName}`, `Servings: ${servings}`, languageNote].filter(Boolean).join('\n')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const cleaned = text.replace(/```(?:json)?\n?/g, '').trim()

  try {
    const { ingredients } = JSON.parse(cleaned) as {
      ingredients: { name: string; quantity: string | null; unit: string | null }[]
    }

    const matched = ingredients.map(ing => {
      const lower = ing.name.toLowerCase()
      const match = pantryItems.find(p =>
        p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase())
      )
      return { ...ing, pantry_item_id: match?.id ?? null }
    })

    return NextResponse.json({ ingredients: matched })
  } catch {
    return NextResponse.json({ error: 'Could not extract ingredients' }, { status: 500 })
  }
}
