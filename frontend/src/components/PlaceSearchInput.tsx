import { useId, useState } from 'react'

export function PlaceSearchInput({ value, onChange, options, label, placeholder, maxLength = 100, disabled = false }: { value: string; onChange: (value: string) => void; options: string[]; label: string; placeholder: string; maxLength?: number; disabled?: boolean }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const query = value.trim().toLowerCase()
  const startsWith = (option: string) => option.toLowerCase().split(/[\s,]+/).some(word => word.startsWith(query))
  const filtered = query.length >= 2 ? options.filter(option => option.toLowerCase().includes(query)).sort((a, b) => Number(startsWith(b)) - Number(startsWith(a))).slice(0, 8) : []
  const expanded = open && !disabled && filtered.length > 0
  const choose = (option: string) => { onChange(option); setOpen(false); setActive(-1) }
  return <div className="city-search">
    <input aria-label={label} role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? id : undefined} aria-activedescendant={expanded && active >= 0 && filtered[active] ? `${id}-${active}` : undefined}
      type="text" value={value} disabled={disabled} placeholder={placeholder} autoComplete="off" maxLength={maxLength}
      onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1) }} onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setActive(-1) }}
      onKeyDown={event => {
        if (event.key === 'Escape') { setOpen(false); setActive(-1); return }
        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && filtered.length) {
          event.preventDefault(); setOpen(true)
          setActive(index => event.key === 'ArrowDown' ? (index + 1) % filtered.length : (index <= 0 ? filtered.length - 1 : index - 1))
        } else if (event.key === 'Enter' && expanded && active >= 0 && filtered[active]) { event.preventDefault(); choose(filtered[active]) }
      }} />
    {expanded && <ul id={id} className="city-suggestions" role="listbox" aria-label={`Suggested ${label.toLowerCase()}`}>{filtered.map((option, index) => <li id={`${id}-${index}`} key={option} role="option" aria-selected={index === active} onPointerDown={event => event.preventDefault()} onClick={() => choose(option)}>{option}</li>)}</ul>}
  </div>
}
