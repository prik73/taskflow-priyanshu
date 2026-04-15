import { useEffect, useRef, useState } from 'react';
import type { Task } from '../types';
import { COLUMNS } from '../utils/task';

interface StatsDropdownProps {
  tasks: Task[];
}

export default function StatsDropdown({ tasks }: StatsDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  if (tasks.length === 0) return null;

  return (
    <div ref={ref} className="stats-dropdown">
      <button
        className="outline small"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        Stats
        <svg
          width="12" height="12" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ marginLeft: '0.25rem', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="stats-dropdown-panel">
          {COLUMNS.map(col => {
            const count = tasks.filter(t => t.status === col.id).length;
            return (
              <div key={col.id} className="stats-dropdown-row" data-status={col.id}>
                <span className="stats-dropdown-dot" />
                <span className="stats-dropdown-label">{col.label}</span>
                <span className="stats-dropdown-count">{count}</span>
              </div>
            );
          })}
          <div className="stats-dropdown-divider" />
          <div className="stats-dropdown-row stats-dropdown-row--total">
            <span className="stats-dropdown-label">Total</span>
            <span className="stats-dropdown-count">{tasks.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
