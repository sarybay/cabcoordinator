'use client'

import { useState, useTransition, useRef, useEffect, useMemo } from 'react'
import type { Passenger, Driver, CarType, Cab } from '@/lib/types'
import { setCabStatus, updatePassengerDetails, assignDriverToCab, updateCabCarType, updateCabPrice, movePassenger, deletePassenger, restorePassenger, updatePassengerField } from '@/app/actions'

function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function fmtYear(date: string | null) {
  if (!date) return null
  return new Date(date).getFullYear()
}

type CabStatusValue = 'pending' | 'in_progress' | 'done'

const STATUS_STYLES: Record<CabStatusValue, string> = {
  pending: 'text-gray-500 bg-gray-50 border-gray-200',
  in_progress: 'text-amber-700 bg-amber-50 border-amber-200',
  done: 'text-green-700 bg-green-50 border-green-200',
}

const STATUS_LABELS: Record<CabStatusValue, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  done: 'Done',
}

function StatusDropdown({ cabId, status, doneBy, onChange, disabled }: {
  cabId: string
  status: CabStatusValue
  doneBy: string | null
  onChange: (cabId: string, next: CabStatusValue) => void
  disabled: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const showTooltip = hovered && status === 'done' && !!doneBy

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <select
        value={status}
        disabled={disabled}
        onChange={e => onChange(cabId, e.target.value as CabStatusValue)}
        className={`text-xs font-medium rounded-full px-2.5 py-1 border appearance-none cursor-pointer disabled:opacity-50 transition-colors ${STATUS_STYLES[status]}`}
      >
        <option value="pending">Pending</option>
        <option value="in_progress">In progress</option>
        <option value="done">Done</option>
      </select>
      {showTooltip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap bg-gray-900 text-white text-xs rounded px-2 py-1 pointer-events-none z-10">
          By {doneBy}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  )
}

const ROW_TINTS: Record<string, { bg: string; intra: string; sep: string }> = {
  blue:   { bg: 'bg-blue-100',   intra: 'border-b-blue-200',   sep: 'border-t-blue-500' },
  green:  { bg: 'bg-green-100',  intra: 'border-b-green-200',  sep: 'border-t-green-500' },
  orange: { bg: 'bg-orange-100', intra: 'border-b-orange-200', sep: 'border-t-orange-500' },
  purple: { bg: 'bg-purple-100', intra: 'border-b-purple-200', sep: 'border-t-purple-500' },
  rose:   { bg: 'bg-rose-100',   intra: 'border-b-rose-200',   sep: 'border-t-rose-500' },
  teal:   { bg: 'bg-teal-100',   intra: 'border-b-teal-200',   sep: 'border-t-teal-500' },
  amber:  { bg: 'bg-amber-100',  intra: 'border-b-amber-200',  sep: 'border-t-amber-500' },
  pink:   { bg: 'bg-pink-100',   intra: 'border-b-pink-200',   sep: 'border-t-pink-500' },
}

function TooltipSelect({ value, tooltip, disabled, onChange, children }: {
  value: string
  tooltip: string | null
  disabled: boolean
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <span className="relative inline-block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="text-xs text-gray-700 bg-transparent border-0 border-b border-dashed border-gray-300 hover:border-gray-500 focus:outline-none focus:border-blue-400 cursor-pointer disabled:opacity-40 pr-4 appearance-none"
      >
        {children}
      </select>
      {hovered && tooltip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap bg-gray-900 text-white text-xs rounded px-2 py-1 pointer-events-none z-20">
          {tooltip}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  )
}

type EditableField = 'name' | 'phone' | 'flight_number' | 'arrival_date' | 'arrival_time' | 'pickup_time' | 'origin' | 'destination'

function EditableCell({ passengerId, field, initialValue, type = 'text', textClass = 'text-gray-500', isDeleted, onSaved }: {
  passengerId: string
  field: EditableField
  initialValue: string | null
  type?: 'text' | 'date' | 'time'
  textClass?: string
  isDeleted: boolean
  onSaved: (id: string, field: EditableField) => void
}) {
  const [editing, setEditing] = useState(false)
  const [displayValue, setDisplayValue] = useState(initialValue)
  const [draft, setDraft] = useState(initialValue ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus() }, [editing])

  function commit() {
    setEditing(false)
    const trimmed = draft.trim()
    const newValue = trimmed || null
    if (newValue === displayValue) return
    setDisplayValue(newValue)
    onSaved(passengerId, field)
    updatePassengerField(passengerId, field, newValue)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setEditing(false); setDraft(displayValue ?? '') }
        }}
        className="w-full min-w-[70px] text-xs border-b border-blue-400 focus:outline-none bg-transparent"
      />
    )
  }

  const formatted = type === 'time' && displayValue
    ? displayValue.slice(0, 5)
    : type !== 'date'
    ? displayValue
    : null

  return (
    <button
      disabled={isDeleted}
      onClick={() => { setDraft(displayValue ?? ''); setEditing(true) }}
      className={`text-left w-full disabled:cursor-default ${isDeleted ? 'line-through' : 'cursor-text'} ${textClass}`}
    >
      {type === 'date' ? (
        displayValue
          ? <span className="whitespace-nowrap">{fmt(displayValue)}<span className="text-[10px] opacity-50 ml-1">{fmtYear(displayValue)}</span></span>
          : <span className="text-gray-300">—</span>
      ) : (
        formatted ?? <span className="text-gray-300">—</span>
      )}
    </button>
  )
}

function PriceCell({ cabId, initialPrice, disabled, onUpdate }: {
  cabId: string
  initialPrice: number | null
  disabled: boolean
  onUpdate: (cabId: string, price: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialPrice != null ? String(initialPrice) : '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus() }, [editing])

  function commit() {
    setEditing(false)
    const num = parseFloat(draft)
    const price = isNaN(num) ? null : num
    onUpdate(cabId, price)
    updateCabPrice(cabId, price)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(initialPrice != null ? String(initialPrice) : '') } }}
        className="w-16 text-xs border-b border-blue-400 focus:outline-none bg-transparent"
      />
    )
  }

  return (
    <button
      disabled={disabled}
      onClick={() => setEditing(true)}
      className="text-xs text-gray-700 border-b border-dashed border-gray-300 hover:border-gray-500 disabled:opacity-40"
    >
      {initialPrice != null ? `€${initialPrice}` : <span className="text-gray-300">—</span>}
    </button>
  )
}

function DetailsCell({ passengerId, initialDetails, initialUpdatedBy, onSaved }: {
  passengerId: string
  initialDetails: string | null
  initialUpdatedBy: string | null
  onSaved?: () => void
}) {
  const [details, setDetails] = useState(initialDetails ?? '')
  const [updatedBy, setUpdatedBy] = useState(initialUpdatedBy)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(details)
  const [hovered, setHovered] = useState(false)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
        setDraft(details)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, details])

  async function handleSave() {
    setSaving(true)
    const result = await updatePassengerDetails(passengerId, draft)
    setSaving(false)
    if (!result?.error) {
      setDetails(draft.trim())
      if (!draft.trim()) setUpdatedBy(null)
      setOpen(false)
      onSaved?.()
    }
  }

  const isFilled = !!details

  return (
    <div className="relative inline-flex items-center">
      <span
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative inline-block"
      >
        <button
          onClick={() => { setDraft(details); setOpen(v => !v) }}
          className={`flex items-center justify-center w-6 h-6 rounded-full transition-colors ${
            isFilled
              ? 'bg-amber-100 hover:bg-amber-200'
              : 'border border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
          title={isFilled ? details : 'Add details'}
        >
          {isFilled
            ? <span className="w-2 h-2 rounded-full bg-amber-500 block" />
            : <span className="w-2 h-2 rounded-full border border-gray-400 block" />
          }
        </button>
        {hovered && updatedBy && !open && (
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap bg-gray-900 text-white text-xs rounded px-2 py-1 pointer-events-none z-20">
            By {updatedBy}
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </span>
        )}
      </span>

      {open && (
        <div
          ref={popoverRef}
          className="absolute left-8 top-0 z-30 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-3"
        >
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Add pickup notes…"
            rows={3}
            className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => { setOpen(false); setDraft(details) }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs font-medium bg-blue-600 text-white rounded-lg px-3 py-1 hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function OptionsMenu({ passenger, cabs }: { passenger: Passenger; cabs: Cab[] }) {
  const [open, setOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const [, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const otherCabs = cabs.filter(c => c.id !== passenger.cabId)

  function handleToggle() {
    if (!open && btnRef.current) {
      const btn = btnRef.current.getBoundingClientRect()
      // Find the nearest scroll container to get its bottom edge
      let el: HTMLElement | null = btnRef.current.parentElement
      while (el) {
        const ov = getComputedStyle(el).overflowY
        if (ov === 'auto' || ov === 'scroll') break
        el = el.parentElement
      }
      const containerBottom = el ? el.getBoundingClientRect().bottom : window.innerHeight
      // Estimate dropdown height: header + each cab row + separator + delete row
      const estimatedHeight = (otherCabs.length > 0 ? 28 + otherCabs.length * 32 + 9 : 0) + 32 + 16
      setOpenUpward(containerBottom - btn.bottom < estimatedHeight)
    }
    setOpen(v => !v)
  }

  function handleMove(toCabId: string) {
    setOpen(false)
    startTransition(() => movePassenger(passenger.id, toCabId))
  }

  function handleDelete() {
    setOpen(false)
    startTransition(() => deletePassenger(passenger.id))
  }

  function handleRestore() {
    setOpen(false)
    startTransition(() => restorePassenger(passenger.id))
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 text-sm font-bold transition-colors"
      >
        ···
      </button>
      {open && (
        <div className={`absolute right-0 z-40 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px] ${openUpward ? 'bottom-7' : 'top-7'}`}>
          {otherCabs.length > 0 && (
            <>
              <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Move to</p>
              <div className="max-h-[180px] overflow-y-auto">
                {otherCabs.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleMove(c.id)}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="border-t border-gray-100 my-1" />
            </>
          )}
          {passenger.isDeleted ? (
            <button
              onClick={handleRestore}
              className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Restore
            </button>
          ) : (
            <button
              onClick={handleDelete}
              className="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function PassengerTable({ passengers, drivers, carTypes, cabs }: {
  passengers: Passenger[]
  drivers: Driver[]
  carTypes: CarType[]
  cabs: Cab[]
}) {
  const [cabStatuses, setCabStatuses] = useState<Record<string, CabStatusValue>>(() => {
    const map: Record<string, CabStatusValue> = {}
    for (const p of passengers) {
      if (p.cabId) map[p.cabId] = p.cabIsDone ? 'done' : p.cabStartedAt ? 'in_progress' : 'pending'
    }
    return map
  })
  const [cabDoneBy, setCabDoneByMap] = useState<Record<string, string | null>>(() => {
    const map: Record<string, string | null> = {}
    for (const p of passengers) {
      if (p.cabId) map[p.cabId] = p.cabDoneBy ?? null
    }
    return map
  })
  const [cabDriverIds, setCabDriverIds] = useState<Record<string, string | null>>(() => {
    const map: Record<string, string | null> = {}
    for (const p of passengers) {
      if (p.cabId) {
        const driver = drivers.find(d => d.name === p.cabDriverName)
        map[p.cabId] = driver?.id ?? null
      }
    }
    return map
  })
  const [cabCarTypeIds, setCabCarTypeIds] = useState<Record<string, string | null>>(() => {
    const map: Record<string, string | null> = {}
    for (const p of passengers) {
      if (p.cabId) map[p.cabId] = p.cabCarTypeId ?? null
    }
    return map
  })
  const [cabPrices, setCabPrices] = useState<Record<string, number | null>>(() => {
    const map: Record<string, number | null> = {}
    for (const p of passengers) {
      if (p.cabId) map[p.cabId] = p.cabPrice ?? null
    }
    return map
  })
  const [editedFieldsMap, setEditedFieldsMap] = useState<Record<string, Set<string>>>(() => {
    const map: Record<string, Set<string>> = {}
    for (const p of passengers) {
      if (p.editedFields.length > 0) map[p.id] = new Set(p.editedFields)
    }
    return map
  })
  const [pending, startTransition] = useTransition()

  const cabGroupSizes = useMemo(() => {
    const sizes: Record<string, number> = {}
    for (const p of passengers) {
      if (p.cabId && !p.isDeleted) sizes[p.cabId] = (sizes[p.cabId] ?? 0) + 1
    }
    return sizes
  }, [passengers])

  function markPassengerEdited(id: string, field: string) {
    setEditedFieldsMap(prev => {
      const next = { ...prev }
      next[id] = new Set([...(prev[id] ?? []), field])
      return next
    })
  }

  function handleStatusChange(cabId: string, next: CabStatusValue) {
    setCabStatuses(prev => ({ ...prev, [cabId]: next }))
    if (next !== 'done') setCabDoneByMap(prev => ({ ...prev, [cabId]: null }))
    // Status is a manual action — mark 'status' field edited for all passengers in this cab
    setEditedFieldsMap(prev => {
      const next = { ...prev }
      passengers.filter(p => p.cabId === cabId && !p.isDeleted).forEach(p => {
        next[p.id] = new Set([...(prev[p.id] ?? []), 'status'])
      })
      return next
    })
    startTransition(async () => {
      const result = await setCabStatus(cabId, next)
      if (next === 'done' && result?.doneBy) {
        setCabDoneByMap(prev => ({ ...prev, [cabId]: result.doneBy! }))
      }
    })
  }

  function handleDriverChange(cabId: string, driverId: string) {
    const id = driverId || null
    setCabDriverIds(prev => ({ ...prev, [cabId]: id }))
    startTransition(() => assignDriverToCab(cabId, id))
  }

  function handleCarTypeChange(cabId: string, carTypeId: string) {
    const id = carTypeId || null
    setCabCarTypeIds(prev => ({ ...prev, [cabId]: id }))
    startTransition(() => updateCabCarType(cabId, id))
  }

  function handlePriceUpdate(cabId: string, price: number | null) {
    setCabPrices(prev => ({ ...prev, [cabId]: price }))
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-clip">
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead className="sticky top-0 z-10 bg-gray-50">
          <tr className="bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <th className="pl-5 pr-2 py-3 text-left w-8">#</th>
            <th className="px-4 py-3 text-center w-10">Details</th>
            <th className="px-4 py-3 text-left">Name</th>
            <th className="px-4 py-3 text-left">Phone</th>
            <th className="px-4 py-3 text-left">Flight</th>
            <th className="px-4 py-3 text-left">From</th>
            <th className="px-4 py-3 text-left">To</th>
            <th className="px-4 py-3 text-left">Arrival date</th>
            <th className="px-4 py-3 text-left">Arrival time</th>
            <th className="px-4 py-3 text-left">Pick up time</th>
            <th className="px-4 py-3 text-left w-10">Cab</th>
            <th className="px-4 py-3 text-left">Driver</th>
            <th className="px-4 py-3 text-left w-14">Pax</th>
            <th className="px-4 py-3 text-left">Car type</th>
            <th className="px-4 py-3 text-left w-20">Price</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-center w-10"></th>
          </tr>
        </thead>
        <tbody>
          {passengers.map((p, idx) => {
            const cabStatus = p.cabId ? (cabStatuses[p.cabId] ?? 'pending') : null
            const isDone = cabStatus === 'done'
            const tint = (!p.isDeleted && p.cabColor) ? (ROW_TINTS[p.cabColor] ?? null) : null
            const isFirstInGroup = idx === 0 || passengers[idx - 1]?.cabId !== p.cabId
            const bgClass = p.isDeleted ? 'bg-white' : (tint?.bg ?? 'bg-white')
            const borderB = tint ? `border-b ${tint.intra}` : 'border-b border-b-gray-100'
            const borderT = isFirstInGroup && idx > 0
              ? (isDone || p.isDeleted) ? 'border-t border-t-gray-200' : `border-t-2 ${tint?.sep ?? 'border-t-gray-300'}`
              : ''
            const currentDriverId = p.cabId ? (cabDriverIds[p.cabId] ?? null) : null
            const currentCarTypeId = p.cabId ? (cabCarTypeIds[p.cabId] ?? null) : null
            const currentPrice = p.cabId ? (cabPrices[p.cabId] ?? null) : null
            const driverTooltip = p.cabDriverChangedBy ? `Changed by ${p.cabDriverChangedBy}` : null
            const isFirstInCab = p.isDeleted || !p.cabId
              ? true
              : idx === 0 || passengers[idx - 1]?.cabId !== p.cabId || passengers[idx - 1]?.isDeleted === true
            const cabRowSpan = p.isDeleted || !p.cabId ? 1 : (cabGroupSizes[p.cabId] ?? 1)

            return (
              <tr key={p.id} className={`transition-opacity ${bgClass} ${borderB} ${borderT} ${isDone ? 'opacity-40' : ''} ${p.isDeleted ? 'opacity-50' : ''}`}>
                <td className="pl-5 pr-2 py-3.5 text-xs text-gray-400 w-8">{idx + 1}</td>
                {/* Details */}
                <td className="px-4 py-3.5 text-center">
                  <span className="flex items-center justify-center gap-0.5">
                    <DetailsCell
                      passengerId={p.id}
                      initialDetails={p.additionalDetails}
                      initialUpdatedBy={p.additionalDetailsUpdatedBy}
                      onSaved={() => markPassengerEdited(p.id, 'details')}
                    />
                    {editedFieldsMap[p.id]?.has('details') && !p.isDeleted && <span className="text-pink-400 text-[5px] font-sans flex-shrink-0">★</span>}
                  </span>
                </td>
                <td className="px-4 py-3.5 font-medium">
                  <span className="flex items-center gap-0.5">
                    <EditableCell passengerId={p.id} field="name" initialValue={p.name} type="text"
                      textClass={p.isDeleted ? 'line-through text-gray-400' : 'text-gray-900'}
                      isDeleted={p.isDeleted} onSaved={markPassengerEdited} />
                    {p.createdManually && !p.isDeleted && <span className="text-blue-400 text-xs align-top flex-shrink-0">*</span>}
                    {editedFieldsMap[p.id]?.has('name') && !p.isDeleted && <span className="text-pink-400 text-[5px] font-sans flex-shrink-0">★</span>}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="flex items-center gap-0.5">
                    <EditableCell passengerId={p.id} field="phone" initialValue={p.phone} type="text"
                      textClass={p.isDeleted ? 'line-through text-gray-300' : 'text-gray-500'}
                      isDeleted={p.isDeleted} onSaved={markPassengerEdited} />
                    {editedFieldsMap[p.id]?.has('phone') && !p.isDeleted && <span className="text-pink-400 text-[5px] font-sans flex-shrink-0">★</span>}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="flex items-center gap-0.5">
                    <EditableCell passengerId={p.id} field="flight_number" initialValue={p.flightNumber} type="text"
                      textClass={p.isDeleted ? 'font-mono line-through text-gray-300' : 'font-mono text-gray-900'}
                      isDeleted={p.isDeleted} onSaved={markPassengerEdited} />
                    {editedFieldsMap[p.id]?.has('flight_number') && !p.isDeleted && <span className="text-pink-400 text-[5px] font-sans flex-shrink-0">★</span>}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="flex items-center gap-0.5">
                    <EditableCell passengerId={p.id} field="origin" initialValue={p.origin} type="text"
                      textClass={p.isDeleted ? 'line-through text-gray-300' : 'text-gray-500'}
                      isDeleted={p.isDeleted} onSaved={markPassengerEdited} />
                    {editedFieldsMap[p.id]?.has('origin') && !p.isDeleted && <span className="text-pink-400 text-[5px] font-sans flex-shrink-0">★</span>}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="flex items-center gap-0.5">
                    <EditableCell passengerId={p.id} field="destination" initialValue={p.destination} type="text"
                      textClass={p.isDeleted ? 'line-through text-gray-300' : 'text-gray-500'}
                      isDeleted={p.isDeleted} onSaved={markPassengerEdited} />
                    {editedFieldsMap[p.id]?.has('destination') && !p.isDeleted && <span className="text-pink-400 text-[5px] font-sans flex-shrink-0">★</span>}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="flex items-center gap-0.5">
                    <EditableCell passengerId={p.id} field="arrival_date" initialValue={p.arrivalDate} type="date"
                      textClass={p.isDeleted ? 'line-through text-gray-300' : 'text-gray-500'}
                      isDeleted={p.isDeleted} onSaved={markPassengerEdited} />
                    {editedFieldsMap[p.id]?.has('arrival_date') && !p.isDeleted && <span className="text-pink-400 text-[5px] font-sans flex-shrink-0">★</span>}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="flex items-center gap-0.5">
                    <EditableCell passengerId={p.id} field="arrival_time" initialValue={p.arrivalTime} type="time"
                      textClass={p.isDeleted ? 'line-through text-gray-300' : 'text-gray-500'}
                      isDeleted={p.isDeleted} onSaved={markPassengerEdited} />
                    {editedFieldsMap[p.id]?.has('arrival_time') && !p.isDeleted && <span className="text-pink-400 text-[5px] font-sans flex-shrink-0">★</span>}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="flex items-center gap-0.5">
                    <EditableCell passengerId={p.id} field="pickup_time" initialValue={p.pickupTime} type="time"
                      textClass={p.isDeleted ? 'line-through text-gray-300' : 'text-gray-500'}
                      isDeleted={p.isDeleted} onSaved={markPassengerEdited} />
                    {editedFieldsMap[p.id]?.has('pickup_time') && !p.isDeleted && <span className="text-pink-400 text-[5px] font-sans flex-shrink-0">★</span>}
                  </span>
                </td>
                {/* Cab # */}
                {isFirstInCab && (
                  <td rowSpan={cabRowSpan} className={`px-4 py-3.5 text-xs font-semibold text-gray-500 align-middle ${bgClass}`}>
                    {p.cabNumber ?? <span className="text-gray-300">—</span>}
                  </td>
                )}
                {/* Driver */}
                {isFirstInCab && (
                  <td rowSpan={cabRowSpan} className={`px-4 py-3.5 align-middle ${bgClass}`}>
                    {p.cabId ? (
                      <TooltipSelect
                        value={currentDriverId ?? ''}
                        tooltip={driverTooltip}
                        disabled={pending}
                        onChange={v => handleDriverChange(p.cabId!, v)}
                      >
                        <option value="">Unassigned</option>
                        {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </TooltipSelect>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </td>
                )}
                {/* Pax in car */}
                {isFirstInCab && (
                  <td rowSpan={cabRowSpan} className={`px-4 py-3.5 text-xs text-gray-600 align-middle ${bgClass}`}>
                    {p.cabId ? p.cabPaxCount : <span className="text-gray-300">—</span>}
                  </td>
                )}
                {/* Car type */}
                {isFirstInCab && (
                  <td rowSpan={cabRowSpan} className={`px-4 py-3.5 align-middle ${bgClass}`}>
                    {p.cabId ? (
                      <TooltipSelect
                        value={currentCarTypeId ?? ''}
                        tooltip={null}
                        disabled={pending}
                        onChange={v => handleCarTypeChange(p.cabId!, v)}
                      >
                        <option value="">—</option>
                        {carTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
                      </TooltipSelect>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </td>
                )}
                {/* Price */}
                {isFirstInCab && (
                  <td rowSpan={cabRowSpan} className={`px-4 py-3.5 align-middle ${bgClass}`}>
                    {p.cabId ? (
                      <PriceCell
                        cabId={p.cabId}
                        initialPrice={currentPrice}
                        disabled={pending}
                        onUpdate={handlePriceUpdate}
                      />
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </td>
                )}
                {/* Status */}
                {isFirstInCab && (
                  <td rowSpan={cabRowSpan} className={`px-4 py-3.5 align-middle ${bgClass}`}>
                    <span className="flex items-center gap-1">
                      {p.cabId && cabStatus ? (
                        <StatusDropdown
                          cabId={p.cabId}
                          status={cabStatus}
                          doneBy={cabDoneBy[p.cabId] ?? null}
                          onChange={handleStatusChange}
                          disabled={pending}
                        />
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                      {editedFieldsMap[p.id]?.has('status') && !p.isDeleted && <span className="text-pink-400 text-[5px] font-sans flex-shrink-0">★</span>}
                    </span>
                  </td>
                )}
                {/* Options */}
                <td className="px-2 py-3.5 text-center">
                  <OptionsMenu passenger={p} cabs={cabs} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Legend */}
      {(() => {
        const hasManual = passengers.some(p => p.createdManually)
        const hasDeleted = passengers.some(p => p.isDeleted)
        const hasEdited = Object.values(editedFieldsMap).some(s => s.size > 0) || passengers.some(p => p.isEdited)
        if (!hasManual && !hasDeleted && !hasEdited) return null
        return (
          <div className="flex items-center gap-5 px-5 py-2.5 border-t border-gray-100 text-xs text-gray-400">
            {hasManual && <span><span className="text-blue-400 font-medium">*</span> Added manually</span>}
            {hasEdited && <span><span className="text-pink-400 font-medium">★</span> Field edited</span>}
            {hasDeleted && <span><span className="line-through text-gray-400">Name</span> Passenger deleted</span>}
          </div>
        )
      })()}
    </div>
  )
}
