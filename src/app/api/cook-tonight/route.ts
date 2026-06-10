import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a family meal planning assistant. Given a list of pantry items, suggest exactly 3 meals the family could cook tonight.

For each suggestion return:
- name: meal name
- emoji: a single food emoji that best represents the dish
- description: 1-2 sentences, friendly and appetising
- key_ingredients: array of 3-5 ingredient names from the provided pantry list that are the main components
- missing: array of up to 3 key ingredient names NOT in the pantry that would be needed, OR pantry items whose available quantity seems insufficient for the number of people (empty array if all good)
- time_minutes: approximate total preparation + cooking time as a number

Return ONLY valid JSON, no other text:
{"suggestions":[{"name":"Pasta Bolognese","emoji":"🍝","description":"A hearty Italian classic...","key_ingredients":["pasta","mince meat"],"missing":[],"time_minutes":30}]}`

export async function POST(req: NextRequest) {
  const { items, servings = 4, maxMinutes = null, vegetarian = false } = await req.json() as {
    items: { name: string; quantity: string | null; unit: string | null }[]
    servings?: number
    maxMinutes?: number | null
    vegetarian?: boolean
  }

  const pantryList = items
    .map(i => `${i.name}${i.quantity ? ` (${i.quantity}${i.unit ? ' ' + i.unit : ''})` : ''}`)
    .join(', ')

  const timeConstraint = maxMinutes != null ? `Time available: up to ${maxMinutes} minutes` : 'No time limit'
  const dietNote       = vegetarian ? 'Dietary requirement: ALL 3 suggestions must be completely vegetarian (no meat, no fish, no poultry).' : ''

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Cooking for: ${servings} people\n${timeConstraint}${dietNote ? '\n' + dietNote : ''}\nPantry items: ${pantryList}` }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const cleaned = text.replace(/```(?:json)?\n?/g, '').trim()

  try {
    return NextResponse.json(JSON.parse(cleaned))
  } catch {
    return NextResponse.json({ error: 'Could not generate suggestions' }, { status: 500 })
  }
}
