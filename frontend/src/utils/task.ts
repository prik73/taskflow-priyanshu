export const COLUMNS = [
  { id: 'todo',        label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'need_review', label: 'Need Review' },
  { id: 'resolved',    label: 'Resolved' },
] as const;

export const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  need_review: 'Need Review',
  resolved: 'Resolved',
};

export function priorityClass(p: string): string {
  return p === 'high' ? 'danger' : p === 'medium' ? 'warning' : 'secondary';
}

export function formatDate(d: string | null): string {
  if (!d) return '';
  const datePart = d.split('T')[0];
  const date = new Date(datePart + 'T12:00:00');
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function isPast(d: string | null): boolean {
  if (!d) return false;
  const datePart = d.split('T')[0];
  return new Date(datePart + 'T12:00:00') < new Date();
}
