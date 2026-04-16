interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function ProjectSearchBar({ value, onChange }: Props) {
  return (
    <div className="projects-search-bar">
      <svg className="projects-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        type="search"
        placeholder="Search projects…"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="projects-search-input"
      />
      {value && (
        <button className="projects-search-clear" onClick={() => onChange('')} aria-label="Clear search">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  );
}
