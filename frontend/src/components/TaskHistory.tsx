import { useEffect, useState } from 'react';
import type { HistoryEntry } from '../types';
import { getTaskHistory } from '../api/tasks';

interface Props {
  taskId: string;
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  need_review: 'Need Review',
  resolved: 'Resolved',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  const diffMo = Math.floor(diffDay / 30);
  if (diffMo < 12) return `${diffMo} month${diffMo === 1 ? '' : 's'} ago`;
  const diffYr = Math.floor(diffMo / 12);
  return `${diffYr} year${diffYr === 1 ? '' : 's'} ago`;
}

function formatDueDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function describeEntry(entry: HistoryEntry): React.ReactNode {
  const b = (text: string) => <strong>{text}</strong>;

  switch (entry.field) {
    case 'created':
      return <>created this task</>;
    case 'status': {
      const from = STATUS_LABELS[entry.old_value ?? ''] ?? entry.old_value;
      const to = STATUS_LABELS[entry.new_value ?? ''] ?? entry.new_value;
      return <>moved from {b(from ?? '—')} to {b(to ?? '—')}</>;
    }
    case 'priority': {
      const from = PRIORITY_LABELS[entry.old_value ?? ''] ?? entry.old_value;
      const to = PRIORITY_LABELS[entry.new_value ?? ''] ?? entry.new_value;
      return <>changed priority from {b(from ?? '—')} to {b(to ?? '—')}</>;
    }
    case 'assignee_id':
      if (!entry.new_value) return <>removed assignee</>;
      return <>assigned to {b(entry.new_value)}</>;
    case 'title':
      return <>renamed task</>;
    case 'description':
      return <>updated description</>;
    case 'due_date':
      if (!entry.new_value) return <>removed due date</>;
      return <>set due date to {b(formatDueDate(entry.new_value))}</>;
    default:
      return <>updated {entry.field}</>;
  }
}

export default function TaskHistory({ taskId }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTaskHistory(taskId)
      .then(r => setEntries(r.history))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading) {
    return <div className="task-history task-history--loading">Loading activity…</div>;
  }

  if (entries.length === 0) {
    return <div className="task-history task-history--empty">No activity yet.</div>;
  }

  return (
    <ul className="task-history">
      {entries.map(entry => (
        <li key={entry.id} className="task-history__item">
          <span className="task-history__dot" aria-hidden="true" />
          <div className="task-history__body">
            <span className="task-history__actor">{entry.user_name}</span>
            {' '}
            <span className="task-history__action">{describeEntry(entry)}</span>
            <time className="task-history__time" dateTime={entry.created_at}>
              {formatRelativeTime(entry.created_at)}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}
