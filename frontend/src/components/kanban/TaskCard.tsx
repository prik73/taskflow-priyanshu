import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../../types';
import { priorityClass, formatDate, isPast } from '../../utils/task';

interface TaskCardProps {
  task: Task;
  currentUserId: string;
  isOwner: boolean;
  usersMap: Record<string, string>;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  isDragging?: boolean;
}

export default function TaskCard({ task, currentUserId, isOwner, usersMap, onEdit, onDelete, isDragging }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const canDelete = isOwner || task.creator_id === currentUserId;

  return (
    <article
      ref={setNodeRef}
      style={{ ...style, opacity: isDragging ? 0.35 : 1 }}
      className="card task-card kanban-card"
      {...listeners}
      {...attributes}
    >
      <div className="task-card-header">
        <div className="task-card-badges">
          <span className={`badge outline ${priorityClass(task.priority)}`}>{task.priority}</span>
        </div>
        <div className="task-card-actions">
          <button
            className="task-icon-btn"
            title="Edit task"
            onClick={e => { e.stopPropagation(); onEdit(task); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          {canDelete && (
            <button
              className="task-icon-btn task-icon-btn--danger"
              title="Delete task"
              onClick={e => { e.stopPropagation(); onDelete(task); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      <p className="task-card-title">{task.title}</p>

      {task.description && (
        <p className="task-card-desc">{task.description}</p>
      )}

      <div className="task-card-footer">
        <div className="task-card-meta">
          {task.assignee_id && (
            <span className="meta-item meta-item--icon meta-assignee">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
              {task.assignee_id === currentUserId ? 'Me' : 'Assigned'}
              <span className="assignee-tooltip">
                {task.assignee_id === currentUserId
                  ? `Me (${usersMap[task.assignee_id] ?? '…'})`
                  : (usersMap[task.assignee_id] ?? 'Unknown user')}
              </span>
            </span>
          )}
          {task.due_date && formatDate(task.due_date) && (
            <span className={`meta-item meta-item--icon${isPast(task.due_date) && task.status !== 'resolved' ? ' overdue' : ''}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {formatDate(task.due_date)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
