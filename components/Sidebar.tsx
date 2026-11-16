'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="13" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="13" width="7" height="7" rx="1" />
        <rect x="13" y="13" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: '/account',
    label: 'Account',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <nav className="w-52 bg-white border-r border-gray-100 flex-shrink-0 py-4 px-3">
      <ul className="space-y-0.5">
        {links.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className={active ? 'text-gray-700' : 'text-gray-400'}>{icon}</span>
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
