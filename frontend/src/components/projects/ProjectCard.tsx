import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project } from '../../types';

interface CardMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}

function CardMenu({ onEdit, onDelete, deleting }: CardMenuProps) {
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

  return (
    <div ref={ref} className="card-menu">
      <button className="task-icon-btn" title="More options" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
        </svg>
      </button>
      {open && (
        <div className="card-menu-dropdown" role="menu">
          <button role="menuitem" onClick={() => { setOpen(false); onEdit(); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit Project
          </button>
          <div className="card-menu-divider" role="separator" />
          <button role="menuitem" className="card-menu-item--danger" disabled={deleting} onClick={() => { setOpen(false); onDelete(); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
            Delete Project
          </button>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface ProjectCardProps {
  project: Project;
  isOwner: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function ProjectCardSkeleton() {
  return (
    <article className="card project-card" aria-hidden="true">
      <div role="status" className="skeleton line" style={{ width: '55%' }} />
      <div role="status" className="skeleton line" style={{ width: '100%' }} />
      <div role="status" className="skeleton line" style={{ width: '70%' }} />
      <div role="status" className="skeleton line" style={{ width: '35%', marginTop: 'auto' }} />
    </article>
  );
}

export default function ProjectCard({ project, isOwner, deleting, onEdit, onDelete }: ProjectCardProps) {
  return (
    <article className="card project-card">
      <div className="project-card-header">
        <Link to={`/projects/${project.id}`} className="project-card-name">
          {project.name}
        </Link>
        {isOwner && (
          <CardMenu onEdit={onEdit} onDelete={onDelete} deleting={deleting} />
        )}
      </div>
      {project.description ? (
        <p className="project-card-desc">{project.description}</p>
      ) : (
        <p className="project-card-desc muted">No description</p>
      )}
      <p className="project-card-meta">Created {formatDate(project.created_at)}</p>
      <Link to={`/projects/${project.id}`} className="button outline small project-card-link">
        View tasks
      </Link>
    </article>
  );
}
