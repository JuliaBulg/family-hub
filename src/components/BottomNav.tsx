'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/',          label: 'Pantry',   emoji: '📦' },
  { href: '/shopping',  label: 'Shopping', emoji: '🛒' },
  { href: '/menu',      label: 'Menu',     emoji: '🍽️' },
  { href: '/recipes',   label: 'Recipes',  emoji: '📖' },
  { href: '/expenses',  label: 'Expenses', emoji: '💰' },
]

const itemClass = 'relative flex flex-col items-center justify-center flex-1 py-1.5 gap-0.5 transition-colors'

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav bg-white border-t border-slate-200 shadow-lg">
      <div className="flex">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
          const inner = (
            <>
              <span className="text-xl leading-none">{tab.emoji}</span>
              <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-emerald-500 rounded-full" />
              )}
            </>
          )

          // Active tab is a plain span — prevents re-navigation to current route
          return isActive ? (
            <span key={tab.href} className={`${itemClass} text-emerald-600`}>
              {inner}
            </span>
          ) : (
            <Link key={tab.href} href={tab.href} className={`${itemClass} text-slate-400 hover:text-slate-600`}>
              {inner}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
