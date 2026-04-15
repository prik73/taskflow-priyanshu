import { apiFetch } from './client';
import type { PaginatedProjects, Project, ProjectStats, ProjectWithTasks } from '../types';

export function listProjects(page = 1, limit = 12, search = ''): Promise<PaginatedProjects> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  return apiFetch<PaginatedProjects>(`/projects/?${params}`);
}

export function checkProjectName(name: string, excludeId?: string): Promise<{ available: boolean }> {
  const params = new URLSearchParams({ name });
  if (excludeId) params.set('exclude_id', excludeId);
  return apiFetch(`/projects/check-name?${params}`);
}

export function createProject(name: string, description?: string): Promise<Project> {
  return apiFetch<Project>('/projects/', {
    method: 'POST',
    body: JSON.stringify({ name, description: description || undefined }),
  });
}

export function getProject(id: string): Promise<ProjectWithTasks> {
  return apiFetch<ProjectWithTasks>(`/projects/${id}`);
}

export function updateProject(id: string, name: string, description?: string): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name, description: description || undefined }),
  });
}

export function deleteProject(id: string): Promise<void> {
  return apiFetch<void>(`/projects/${id}`, { method: 'DELETE' });
}

export function getProjectStats(id: string): Promise<ProjectStats> {
  return apiFetch<ProjectStats>(`/projects/${id}/stats`);
}
