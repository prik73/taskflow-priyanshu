import { apiFetch } from './client';
import type { HistoryEntry, PaginatedTasks, Task, User } from '../types';

export function getUsers(): Promise<{ users: User[] }> {
  return apiFetch<{ users: User[] }>('/users');
}

export interface TaskFilters {
  status?: string;
  assignee?: string;
  page?: number;
  limit?: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: string;
  assignee_id?: string | null;
  due_date?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assignee_id?: string | null;
  due_date?: string | null;
  clear_assignee?: boolean;
}

export function listTasks(projectId: string, filters: TaskFilters = {}): Promise<PaginatedTasks> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.assignee) params.set('assignee', filters.assignee);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return apiFetch<PaginatedTasks>(`/projects/${projectId}/tasks${qs ? `?${qs}` : ''}`);
}

export function createTask(projectId: string, input: CreateTaskInput): Promise<Task> {
  return apiFetch<Task>(`/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteTask(id: string): Promise<void> {
  return apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' });
}

export function getTaskHistory(taskId: string): Promise<{ history: HistoryEntry[] }> {
  return apiFetch<{ history: HistoryEntry[] }>(`/tasks/${taskId}/history`);
}

export interface ProjectHistoryEntry extends HistoryEntry {
  task_title: string;
}

export function getProjectHistory(
  projectId: string,
  limit = 15,
  offset = 0,
): Promise<{ history: ProjectHistoryEntry[]; has_more: boolean }> {
  return apiFetch(`/projects/${projectId}/history?limit=${limit}&offset=${offset}`);
}
