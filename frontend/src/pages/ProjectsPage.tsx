import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { listProjects, deleteProject } from '../api/projects';
import type { Project } from '../types';
import Navbar from '../components/Navbar';
import ProjectModal from '../components/ProjectModal';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../contexts/AuthContext';

const PAGE_SIZE = 12;

function CardMenu({ onEdit, onDelete, deleting }: { onEdit: () => void; onDelete: () => void; deleting: boolean }) {
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

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listProjects(page, PAGE_SIZE, debouncedSearch);
      setProjects(data.projects ?? []);
      setTotal(data.total);
    } catch {
      setError('Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => { void fetchProjects(); }, [fetchProjects]);

  function handleSaved(project: Project) {
    setProjects(prev => {
      const existing = prev.findIndex(p => p.id === project.id);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = project;
        return next;
      }
      return [project, ...prev];
    });
    setEditProject(null);
    setShowModal(false);
  }

  async function handleDelete(project: Project) {
    setDeletingId(project.id);
    try {
      await deleteProject(project.id);
      setProjects(prev => prev.filter(p => p.id !== project.id));
      setTotal(t => t - 1);
    } catch {
      setError('Failed to delete project. Please try again.');
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <Navbar />
      <main className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Projects</h1>
            <p className="page-subtitle">
              {loading ? '' : `${total} project${total !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button onClick={() => { setEditProject(null); setShowModal(true); }}>
            + New Project
          </button>
        </div>

        {/* Search bar */}
        <div className="projects-search-bar">
          <svg className="projects-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            placeholder="Search projects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="projects-search-input"
          />
          {search && (
            <button className="projects-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {error && (
          <div role="alert" data-variant="error" style={{ marginBottom: '1.5rem' }}>
            {error}{' '}
            <button className="ghost small" onClick={() => void fetchProjects()}>Retry</button>
          </div>
        )}

        {loading ? (
          <div className="spinner-center" aria-busy="true" data-spinner="large" />
        ) : projects.length === 0 ? (
          <div className="empty-state">
            {debouncedSearch ? (
              <>
                <p className="empty-state-title">No projects found</p>
                <p className="empty-state-body">No projects match "{debouncedSearch}".</p>
                <button className="outline" onClick={() => setSearch('')}>Clear search</button>
              </>
            ) : (
              <>
                <p className="empty-state-title">No projects yet</p>
                <p className="empty-state-body">Create your first project to start tracking tasks.</p>
                <button onClick={() => { setEditProject(null); setShowModal(true); }}>+ New Project</button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="projects-grid">
              {projects.map(project => (
                <article key={project.id} className="card project-card">
                  <div className="project-card-header">
                    <Link to={`/projects/${project.id}`} className="project-card-name">
                      {project.name}
                    </Link>
                    {project.owner_id === user?.id && (
                      <CardMenu
                        onEdit={() => { setEditProject(project); setShowModal(true); }}
                        onDelete={() => setConfirmDelete(project)}
                        deleting={deletingId === project.id}
                      />
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
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="outline small"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  ← Prev
                </button>
                <span className="pagination-info">
                  Page {page} of {totalPages}
                </span>
                <button
                  className="outline small"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {showModal && (
        <ProjectModal
          project={editProject}
          onClose={() => { setShowModal(false); setEditProject(null); }}
          onSaved={handleSaved}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete project"
          body={`"${confirmDelete.name}" and all its tasks will be permanently deleted.`}
          confirmLabel="Delete project"
          confirmPhrase="let's hire this human being"
          danger
          onConfirm={() => void handleDelete(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
