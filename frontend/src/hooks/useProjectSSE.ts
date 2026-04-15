import { useEffect } from 'react';
import type { Task } from '../types';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080';

interface Handlers {
  onCreated: (task: Task) => void;
  onUpdated: (task: Task) => void;
  onDeleted: (id: string) => void;
}

export function useProjectSSE(projectId: string | undefined, handlers: Handlers) {
  useEffect(() => {
    if (!projectId) return;
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const url = `${API_URL}/projects/${projectId}/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    const onCreated = (e: MessageEvent) => {
      const ev = JSON.parse(e.data) as { payload: Task };
      handlers.onCreated(ev.payload);
    };
    const onUpdated = (e: MessageEvent) => {
      const ev = JSON.parse(e.data) as { payload: Task };
      handlers.onUpdated(ev.payload);
    };
    const onDeleted = (e: MessageEvent) => {
      const ev = JSON.parse(e.data) as { payload: { id: string } };
      handlers.onDeleted(ev.payload.id);
    };

    es.addEventListener('task.created', onCreated);
    es.addEventListener('task.updated', onUpdated);
    es.addEventListener('task.deleted', onDeleted);

    return () => {
      es.removeEventListener('task.created', onCreated);
      es.removeEventListener('task.updated', onUpdated);
      es.removeEventListener('task.deleted', onDeleted);
      es.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
}
