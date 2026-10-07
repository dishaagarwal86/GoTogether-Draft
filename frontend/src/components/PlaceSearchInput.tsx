import { useState } from 'react'

export function PlaceSearchInput({ value, onChange, options, label, placeholder, maxLength = 100 }: { value: string; onChange: (v: string) => void; options: string[]; label: string; placeholder: string; maxLength?: number }) {
  const [open, setOpen] = useState(false)
  const query = value.trim().toLowerCase()
  const startsWith = (option: string) => option.toLowerCase().split(/[\s,]+/).some(word => word.startsWith(query))
  const filtered = query.length >= 2 ? options.filter(option => option.toLowerCase().includes(query)).sort((a, b) => Number(startsWith(b)) - Number(startsWith(a)) || Number(b.toLowerCase().startsWith(query)) - Number(a.toLowerCase().startsWith(query))).slice(0, 8) : []
  return <div className="city-search"><input aria-label={label} type="text" value={value} onChange={(e) => { onChange(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder={placeholder} autoComplete="off" maxLength={maxLength} />{open && filtered.length > 0 && <ul className="city-suggestions" role="listbox" aria-label={`Suggested ${label.toLowerCase()}`}>{filtered.map((option) => <li key={option} role="option" aria-selected={option === value} onMouseDown={() => { onChange(option); setOpen(false) }}>{option}</li>)}</ul>}</div>
}
