import { useEffect, useState, useCallback } from 'react';
import { listProjects, deleteProject } from '../api/projects';
import type { Project } from '../types';

const PAGE_SIZE = 12;

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState('');

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
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
      setInitialLoad(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => { void fetchProjects(); }, [fetchProjects]);

  function handleSaved(project: Project) {
    setProjects(prev => {
      const idx = prev.findIndex(p => p.id === project.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = project; return next; }
      return [project, ...prev];
    });
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
    }
  }

  return {
    projects, total, page, setPage,
    search, setSearch, debouncedSearch,
    loading, initialLoad, error,
    deletingId,
    totalPages: Math.ceil(total / PAGE_SIZE),
    fetchProjects, handleSaved, handleDelete,
  };
}
