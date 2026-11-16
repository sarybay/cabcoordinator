'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import type { Cab, Driver } from '@/lib/types'
import { assignDriverToCab, movePassenger } from '@/app/actions'

const COLOR_STYLES: Record<string, { border: string; badge: string }> = {
  blue:   { border: 'border-l-blue-400',   badge: 'bg-blue-100 text-blue-700' },
  green:  { border: 'border-l-green-400',  badge: 'bg-green-100 text-green-700' },
  orange: { border: 'border-l-orange-400', badge: 'bg-orange-100 text-orange-700' },
  purple: { border: 'border-l-purple-400', badge: 'bg-purple-100 text-purple-700' },
  rose:   { border: 'border-l-rose-400',   badge: 'bg-rose-100 text-rose-700' },
  teal:   { border: 'border-l-teal-400',   badge: 'bg-teal-100 text-teal-700' },
  amber:  { border: 'border-l-amber-400',  badge: 'bg-amber-100 text-amber-700' },
  pink:   { border: 'border-l-pink-400',   badge: 'bg-pink-100 text-pink-700' },
}

function fmt(date: string | null) {
  if (!date) return null
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function CabCard({
  cab,
  allCabs,
  drivers,
}: {
  cab: Cab
  allCabs: Cab[]
  drivers: Driver[]
}) {
  const [movingId, setMovingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const colorStyle = COLOR_STYLES[cab.color ?? ''] ?? { border: 'border-l-gray-300', badge: 'bg-gray-100 text-gray-600' }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMovingId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function move(passengerId: string, toCabId: string) {
    setMovingId(null)
    startTransition(() => movePassenger(passengerId, toCabId))
  }

  function changeDriver(driverId: string) {
    startTransition(() => assignDriverToCab(cab.id, driverId === '' ? null : driverId))
  }

  const otherCabs = allCabs.filter(c => c.id !== cab.id)
  const times = cab.passengers.flatMap(p => p.arrivalTime ? [p.arrivalTime] : []).sort()
  const timeLabel =
    times.length === 0 ? 'Time unknown'
    : times.length === 1 ? times[0]
    : `${times[0]}–${times[times.length - 1]}`
  const date = fmt(cab.passengers.find(p => p.arrivalDate)?.arrivalDate ?? null)

  return (
    <div className={`bg-white rounded-2xl border border-l-4 p-4 transition-opacity ${
      cab.isDone
        ? 'border-gray-200 border-l-gray-300 opacity-50 grayscale'
        : `border-gray-100 ${colorStyle.border}`
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{cab.label}</h3>
          <p className="text-sm text-gray-400 mt-0.5">
            {date ? `${date} · ` : ''}{timeLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/export/cab-pdf/${cab.id}`}
            className="text-xs font-medium text-gray-500 border border-gray-200 rounded-md px-2 py-0.5 hover:border-gray-400 hover:text-gray-800 hover:bg-gray-50 transition-colors"
            title="Download driver sheet"
          >
            ↓ PDF
          </a>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${colorStyle.badge}`}>
            {cab.passengers.length} pax
          </span>
        </div>
      </div>

      {/* Passenger list */}
      <div className="space-y-1.5 mb-4" ref={dropdownRef}>
        {cab.passengers.map(p => (
          <div key={p.id} className="flex items-center gap-2 text-sm">
            <span className="text-gray-800 font-medium flex-1">{p.name ?? 'Unknown'}</span>
            <span className="text-gray-400 font-mono text-xs">{p.flightNumber}</span>
            {otherCabs.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setMovingId(movingId === p.id ? null : p.id)}
                  className="text-xs text-gray-400 hover:text-gray-700 px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors"
                >
                  Move
                </button>
                {movingId === p.id && (
                  <div className="absolute right-0 top-6 z-10 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px]">
                    {otherCabs.map(c => (
                      <button
                        key={c.id}
                        onClick={() => move(p.id, c.id)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-700"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Driver assignment */}
      <div className="border-t border-gray-50 pt-3">
        {cab.isDone ? (
          <span className="text-xs font-medium text-green-600 flex items-center gap-1">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="10 3 5 8 2 5" />
            </svg>
            Driver done
          </span>
        ) : cab.startedAt ? (
          <span className="text-xs font-medium text-amber-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            In progress
          </span>
        ) : drivers.length > 0 ? (
          <select
            value={cab.driverId ?? ''}
            onChange={e => changeDriver(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-black text-gray-700 bg-white"
          >
            <option value="">— Assign driver —</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-gray-400">No drivers yet — invite one from Account.</p>
        )}
      </div>
    </div>
  )
}
