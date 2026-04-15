import { useEffect, useRef, useState } from 'react';
import { getProjectHistory } from '../api/tasks';
import type { ProjectHistoryEntry } from '../api/tasks';

interface Props {
  projectId: string;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do', in_progress: 'In Progress',
  need_review: 'Need Review', resolved: 'Resolved',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low', medium: 'Medium', high: 'High',
};

const PAGE_SIZE = 15;

function relativeTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function describeChange(entry: ProjectHistoryEntry): React.ReactNode {
  const b = (t: string) => <strong>{t}</strong>;
  switch (entry.field) {
    case 'created':    return <>created task {b(`"${entry.task_title}"`)}</>;
    case 'status':     return <>{b(`"${entry.task_title}"`)}: {STATUS_LABELS[entry.old_value ?? ''] ?? entry.old_value} → {b(STATUS_LABELS[entry.new_value ?? ''] ?? entry.new_value ?? '—')}</>;
    case 'priority':   return <>{b(`"${entry.task_title}"`)}: priority {PRIORITY_LABELS[entry.old_value ?? ''] ?? entry.old_value} → {b(PRIORITY_LABELS[entry.new_value ?? ''] ?? entry.new_value ?? '—')}</>;
    case 'assignee_id':
      if (!entry.new_value) return <>{b(`"${entry.task_title}"`)}: removed assignee</>;
      return <>{b(`"${entry.task_title}"`)}: assigned to {b(entry.new_value)}</>;
    case 'title':       return <>renamed a task to {b(`"${entry.task_title}"`)}</>;
    case 'description': return <>{b(`"${entry.task_title}"`)}: updated description</>;
    case 'due_date':
      if (!entry.new_value) return <>{b(`"${entry.task_title}"`)}: removed due date</>;
      return <>{b(`"${entry.task_title}"`)}: due date → {b(new Date(entry.new_value + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))}</>;
    default: return <>{b(`"${entry.task_title}"`)}: updated {entry.field}</>;
  }
}

export default function ActivityModal({ projectId, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [entries, setEntries] = useState<ProjectHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, []);

  useEffect(() => {
    setLoading(true);
    getProjectHistory(projectId, PAGE_SIZE, 0)
      .then(r => {
        setEntries(r.history);
        setHasMore(r.has_more);
        setOffset(PAGE_SIZE);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const r = await getProjectHistory(projectId, PAGE_SIZE, offset);
      setEntries(prev => [...prev, ...r.history]);
      setHasMore(r.has_more);
      setOffset(prev => prev + PAGE_SIZE);
    } catch {
      // silently fail — existing entries stay
    } finally {
      setLoadingMore(false);
    }
  }

  function handleClose() {
    dialogRef.current?.close();
    onClose();
  }

  return (
    <dialog ref={dialogRef} onCancel={handleClose} className="activity-dialog">
      <header>
        <h2>Activity</h2>
        <p>All changes across this project</p>
      </header>

      <div className="activity-body">
        {loading ? (
          <div className="activity-empty">
            <div className="spinner-center" aria-busy="true" />
          </div>
        ) : entries.length === 0 ? (
          <div className="activity-empty">No activity yet.</div>
        ) : (
          <>
            <ul className="activity-feed">
              {entries.map(entry => (
                <li key={entry.id} className="activity-item">
                  <div className="activity-avatar">{entry.user_name.charAt(0).toUpperCase()}</div>
                  <div className="activity-content">
                    <span className="activity-actor">{entry.user_name}</span>
                    {' '}
                    <span className="activity-action">{describeChange(entry)}</span>
                    <time className="activity-time" dateTime={entry.created_at}>
                      {relativeTime(entry.created_at)}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
            {hasMore && (
              <div className="activity-load-more">
                <button
                  className="outline small"
                  onClick={loadMore}
                  disabled={loadingMore}
                  aria-busy={loadingMore || undefined}
                >
                  {loadingMore ? '' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <footer>
        <button onClick={handleClose}>Close</button>
      </footer>
    </dialog>
  );
}
