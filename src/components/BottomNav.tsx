import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

interface Tab {
  to: string
  label: string
  icon: ReactNode
}

// 圖示直接內嵌 SVG，離線時也不需要額外載入檔案
const svgProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

const tabs: Tab[] = [
  {
    to: '/',
    label: '牌組',
    icon: (
      <svg {...svgProps}>
        <rect x="6" y="3" width="14" height="14" rx="2" />
        <path d="M4 7v12a2 2 0 0 0 2 2h12" />
      </svg>
    ),
  },
  {
    to: '/browse',
    label: '瀏覽',
    icon: (
      <svg {...svgProps}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    ),
  },
  {
    to: '/stats',
    label: '統計',
    icon: (
      <svg {...svgProps}>
        <path d="M5 20V10M12 20V4M19 20v-7" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: '設定',
    icon: (
      <svg {...svgProps}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
      </svg>
    ),
  },
]

/** 底部導覽列：四個分頁。按鈕高度 56px（大於 48px 的觸控下限），並避開 iPhone 底部橫條 */
export function BottomNav() {
  return (
    <nav
      aria-label="主要導覽"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
    >
      <ul className="mx-auto flex max-w-xl">
        {tabs.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              {tab.icon}
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
