import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a grocery receipt parser. Extract all product items from the receipt.

For each item return:
- name: clean product name (no prices, quantities in the name, or item codes)
- category: exactly one of "food", "household", "drinks", "personal", "medicine", "pets", "other"
- quantity: numeric amount as a string if visible, otherwise null
- unit: unit like "g", "kg", "L", "ml", "pcs", "bottle", "pack" — or null
- price: the total line price for this item as a number (not unit price), or null if not visible

Return ONLY valid JSON, no other text:
{"items":[{"name":"Pasta","category":"food","quantity":"500","unit":"g","price":1.29}]}`

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { type, data, mediaType } = body as {
    type: 'image' | 'pdf' | 'text'
    data: string
    mediaType?: string
  }

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
    system: SYSTEM_PROMPT,
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
