import { useState } from 'react';
import Navbar from '../components/Navbar';
import ProjectModal from '../components/ProjectModal';
import ConfirmModal from '../components/ConfirmModal';
import ProjectCard from '../components/projects/ProjectCard';
import ProjectSearchBar from '../components/projects/ProjectSearchBar';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../contexts/AuthContext';
import type { Project } from '../types';

export default function ProjectsPage() {
  const { user } = useAuth();
  const {
    projects, total, page, setPage,
    search, setSearch, debouncedSearch,
    loading, initialLoad, error,
    deletingId, totalPages,
    fetchProjects, handleSaved, handleDelete,
  } = useProjects();

  const [showModal, setShowModal] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);

  function openCreate() { setEditProject(null); setShowModal(true); }

  return (
    <>
      <Navbar />
      <main className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Projects</h1>
            <p className="page-subtitle" style={{ opacity: loading && !initialLoad ? 0.4 : 1, transition: 'opacity 0.15s' }}>
              {!initialLoad && `${total} project${total !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button onClick={openCreate}>+ New Project</button>
        </div>

        <ProjectSearchBar value={search} onChange={setSearch} />

        {error && (
          <div role="alert" data-variant="error" style={{ marginBottom: '1.5rem' }}>
            {error}{' '}
            <button className="ghost small" onClick={() => void fetchProjects()}>Retry</button>
          </div>
        )}

        {loading && initialLoad ? (
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
                <button onClick={openCreate}>+ New Project</button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="projects-grid">
              {projects.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isOwner={project.owner_id === user?.id}
                  deleting={deletingId === project.id}
                  onEdit={() => { setEditProject(project); setShowModal(true); }}
                  onDelete={() => setConfirmDelete(project)}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button className="outline small" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  ← Prev
                </button>
                <span className="pagination-info">Page {page} of {totalPages}</span>
                <button className="outline small" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
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
          onSaved={p => { handleSaved(p); setShowModal(false); setEditProject(null); }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete project"
          body={`"${confirmDelete.name}" and all its tasks will be permanently deleted.`}
          confirmLabel="Delete project"
          confirmPhrase="let's hire this human being"
          danger
          onConfirm={() => void handleDelete(confirmDelete).then(() => setConfirmDelete(null))}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
