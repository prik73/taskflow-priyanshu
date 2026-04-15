import { useEffect, useRef, useState } from 'react';
import type { Task, User } from '../types';
import { ApiError } from '../api/client';
import { createTask, getUsers, updateTask } from '../api/tasks';
import { useAuth } from '../contexts/AuthContext';
import UserSelect from './UserSelect';

interface Props {
  projectId: string;
  task?: Task | null;
  onClose: () => void;
  onSaved: (task: Task) => void;
}

const STATUSES = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'need_review', label: 'Need Review' },
  { value: 'resolved', label: 'Resolved' },
] as const;

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const;

export default function TaskModal({ projectId, task, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isEdit = task != null;

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<string>(task?.status ?? 'todo');
  const [priority, setPriority] = useState<string>(task?.priority ?? 'medium');
  const [assignee, setAssignee] = useState<string>(task?.assignee_id ?? '');
  const [dueDate, setDueDate] = useState<string>(task?.due_date ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    dialogRef.current?.showModal();
    getUsers().then(r => setUsers(r.users)).catch(() => {});
    return () => dialogRef.current?.close();
  }, []);

  function handleClose() {
    dialogRef.current?.close();
    onClose();
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);

    try {
      let saved: Task;
      if (isEdit) {
        saved = await updateTask(task.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          assignee_id: assignee || undefined,
          clear_assignee: !assignee || undefined,
          due_date: dueDate || undefined,
        });
      } else {
        saved = await createTask(projectId, {
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          assignee_id: assignee || undefined,
          due_date: dueDate || undefined,
        });
      }
      onSaved(saved);
      handleClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) setFieldErrors(err.fields);
        else setError('Something went wrong. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <dialog ref={dialogRef} onCancel={handleClose}>
      <form onSubmit={handleSubmit}>
        <header>
          <h2>{isEdit ? 'Edit Task' : 'New Task'}</h2>
        </header>

        <div>
          {error && (
            <div role="alert" data-variant="error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <div data-field={fieldErrors.title ? 'error' : undefined}>
            <label htmlFor="task-title">
              Title <span aria-hidden="true">*</span>
              <input
                id="task-title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                required
                maxLength={200}
                autoFocus
                aria-invalid={!!fieldErrors.title}
              />
            </label>
            {fieldErrors.title && <p className="error">{fieldErrors.title}</p>}
          </div>

          <div data-field={undefined}>
            <label htmlFor="task-desc">
              Description
              <textarea
                id="task-desc"
                value={description}
                onChange={e => {
                  setDescription(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                placeholder="Optional details"
                rows={3}
                maxLength={5000}
                style={{ resize: 'none', overflow: 'auto', minHeight: '5rem', maxHeight: '12rem' }}
              />
            </label>
          </div>

          <div className="form-row">
            <div data-field={fieldErrors.status ? 'error' : undefined}>
              <label htmlFor="task-status">
                Status
                <div className="status-pill-wrap status-pill-wrap--block" data-status={status}>
                  <select
                    id="task-status"
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                  >
                    {STATUSES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </label>
              {fieldErrors.status && <p className="error">{fieldErrors.status}</p>}
            </div>

            <div data-field={fieldErrors.priority ? 'error' : undefined}>
              <label htmlFor="task-priority">
                Priority
                <div className="status-pill-wrap status-pill-wrap--block" data-status={`priority-${priority}`}>
                  <select
                    id="task-priority"
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                  >
                    {PRIORITIES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </label>
              {fieldErrors.priority && <p className="error">{fieldErrors.priority}</p>}
            </div>
          </div>

          <div className="form-row">
            <div data-field={fieldErrors.assignee_id ? 'error' : undefined}>
              <label htmlFor="task-assignee">
                Assignee
                <UserSelect
                  users={users}
                  value={assignee}
                  currentUserId={user?.id}
                  onChange={setAssignee}
                />
              </label>
              {fieldErrors.assignee_id && <p className="error">{fieldErrors.assignee_id}</p>}
            </div>

            <div data-field={fieldErrors.due_date ? 'error' : undefined}>
              <label htmlFor="task-due">
                Due date
                <input
                  id="task-due"
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </label>
              {fieldErrors.due_date && <p className="error">{fieldErrors.due_date}</p>}
            </div>
          </div>
        </div>

        <footer>
          <button type="button" className="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" disabled={loading} aria-busy={loading || undefined}>
            {loading ? '' : isEdit ? 'Save changes' : 'Create task'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
