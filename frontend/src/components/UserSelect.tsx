import { useEffect, useRef, useState } from 'react';
import type { User } from '../types';

interface Props {
  users: User[];
  value: string;
  currentUserId?: string;
  onChange: (id: string) => void;
}

export default function UserSelect({ users, value, currentUserId, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce 200ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search on open, clear on close
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    else setQuery('');
  }, [open]);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(debouncedQuery.toLowerCase())
  );

  const selectedUser = users.find(u => u.id === value);
  const displayLabel = selectedUser
    ? (selectedUser.id === currentUserId ? `Me (${selectedUser.name})` : selectedUser.name)
    : 'Unassigned';

  function select(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div className="user-select" ref={containerRef}>
      <button
        type="button"
        className="user-select-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{displayLabel}</span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="user-select-dropdown" role="listbox">
          <div className="user-select-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search users…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <ul>
            <li
              role="option"
              aria-selected={value === ''}
              className={value === '' ? 'selected' : ''}
              onMouseDown={() => select('')}
            >
              <span className="user-select-name">Unassigned</span>
            </li>
            {filtered.length === 0 ? (
              <li className="user-select-empty">No users found</li>
            ) : (
              filtered.map(u => (
                <li
                  key={u.id}
                  role="option"
                  aria-selected={value === u.id}
                  className={value === u.id ? 'selected' : ''}
                  onMouseDown={() => select(u.id)}
                >
                  <span className="user-select-name">
                    {u.id === currentUserId ? `Me (${u.name})` : u.name}
                  </span>
                  <span className="user-select-email">{u.email}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
