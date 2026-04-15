import { useEffect, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getProject, deleteProject } from '../api/projects';
import { listTasks, updateTask, deleteTask, getUsers } from '../api/tasks';
import { ApiError } from '../api/client';
import type { Project, Task } from '../types';
import Navbar from '../components/Navbar';
import TaskModal from '../components/TaskModal';
import ProjectModal from '../components/ProjectModal';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080';

//Helpers 

function priorityClass(p: string): string {
  return p === 'high' ? 'danger' : p === 'medium' ? 'warning' : 'secondary';
}

function formatDate(d: string | null): string {
  if (!d) return '';
  const datePart = d.split('T')[0];
  const date = new Date(datePart + 'T12:00:00');
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isPast(d: string | null): boolean {
  if (!d) return false;
  const datePart = d.split('T')[0];
  return new Date(datePart + 'T12:00:00') < new Date();
}

// ── Column config ─────────────────────────────────────────────────────────────

const COLUMNS = [
  { id: 'todo',        label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'need_review', label: 'Need Review' },
  { id: 'resolved',    label: 'Resolved' },
] as const;

// ── Task Card (draggable) ─────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  currentUserId: string;
  isOwner: boolean;
  usersMap: Record<string, string>;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  /** Fades the source card while it's being dragged */
  isDragging?: boolean;
}

function TaskCard({ task, currentUserId, isOwner, usersMap, onEdit, onDelete, isDragging }: TaskCardProps) {
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

// ── Kanban Column (droppable) ─────────────────────────────────────────────────

interface KanbanColumnProps {
  id: string;
  label: string;
  tasks: Task[];
  currentUserId: string;
  isOwner: boolean;
  usersMap: Record<string, string>;
  activeId: string | null;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

function KanbanColumn({ id, label, tasks, currentUserId, isOwner, usersMap, activeId, onEdit, onDelete }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column${isOver ? ' kanban-column--over' : ''}`}
      data-status={id}
    >
      <div className="kanban-column-header">
        <span className="kanban-column-label">{label}</span>
        <span className="kanban-column-count">{tasks.length}</span>
      </div>
      <div className="kanban-column-body">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            currentUserId={currentUserId}
            isOwner={isOwner}
            usersMap={usersMap}
            onEdit={onEdit}
            onDelete={onDelete}
            isDragging={task.id === activeId}
          />
        ))}
        {tasks.length === 0 && (
          <div className="kanban-empty-col">No tasks</div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<Task | null>(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const isOwner = project?.owner_id === user?.id;
  const { success, error: toastError } = useToast();

  const STATUS_LABELS: Record<string, string> = {
    todo: 'To Do', in_progress: 'In Progress', need_review: 'Need Review', resolved: 'Resolved',
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Load users for assignee display
  useEffect(() => {
    getUsers().then(r => {
      const map: Record<string, string> = {};
      r.users.forEach(u => { map[u.id] = u.name; });
      setUsersMap(map);
    }).catch(() => {});
  }, []);

  // Initial load — fetch project metadata + all tasks
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    Promise.all([
      getProject(id),
      listTasks(id, { limit: 500 }),
    ])
      .then(([proj, tasksData]) => {
        setProject(proj);
        setTasks(tasksData.tasks ?? []);
      })
      .catch(err => {
        if (err instanceof ApiError && err.status === 404) setError('Project not found.');
        else setError('Failed to load project. Please try again.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // SSE — real-time task events
  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const url = `${API_URL}/projects/${id}/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    const onOpen = () => {};
    const onError = () => {};

    const onCreated = (e: MessageEvent) => {
      const ev = JSON.parse(e.data) as { payload: Task };
      setTasks(prev => prev.some(t => t.id === ev.payload.id) ? prev : [...prev, ev.payload]);
    };

    const onUpdated = (e: MessageEvent) => {
      const ev = JSON.parse(e.data) as { payload: Task };
      setTasks(prev => prev.map(t => t.id === ev.payload.id ? ev.payload : t));
    };

    const onDeleted = (e: MessageEvent) => {
      const ev = JSON.parse(e.data) as { payload: { id: string } };
      setTasks(prev => prev.filter(t => t.id !== ev.payload.id));
    };

    es.addEventListener('open', onOpen);
    es.addEventListener('error', onError);
    es.addEventListener('task.created', onCreated);
    es.addEventListener('task.updated', onUpdated);
    es.addEventListener('task.deleted', onDeleted);

    return () => {
      es.removeEventListener('open', onOpen);
      es.removeEventListener('error', onError);
      es.removeEventListener('task.created', onCreated);
      es.removeEventListener('task.updated', onUpdated);
      es.removeEventListener('task.deleted', onDeleted);
      es.close();
    };
  }, [id]);

  // Drag handlers
  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const newStatus = String(over.id);
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as Task['status'] } : t));
    try {
      const updated = await updateTask(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
      success(`"${task.title}" moved to ${STATUS_LABELS[newStatus] ?? newStatus}`);
    } catch {
      setTasks(prev => prev.map(t => t.id === taskId ? task : t));
      toastError('Failed to move task. Please try again.');
    }
  }

  function handleTaskSaved(savedTask: Task) {
    const isNew = !tasks.some(t => t.id === savedTask.id);
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === savedTask.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = savedTask;
        return next;
      }
      return [...prev, savedTask];
    });
    setEditTask(null);
    setShowTaskModal(false);
    if (isNew) {
      success(`"${savedTask.title}" created`);
    } else {
      success('Task updated');
    }
  }

  async function handleDeleteTask(task: Task) {
    try {
      await deleteTask(task.id);
      setTasks(prev => prev.filter(t => t.id !== task.id));
    } catch {
      toastError('Failed to delete task. Please try again.');
    } finally {
      setConfirmDeleteTask(null);
    }
  }

  async function handleDeleteProject() {
    if (!project) return;
    try {
      await deleteProject(project.id);
      navigate('/projects', { replace: true });
    } catch {
      toastError('Failed to delete project. Please try again.');
      setConfirmDeleteProject(false);
    }
  }

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;
  const filteredTasks = assigneeFilter ? tasks.filter(t => t.assignee_id === assigneeFilter) : tasks;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="page-container">
          <div className="spinner-center" aria-busy="true" data-spinner="large" />
        </main>
      </>
    );
  }

  if (error && !project) {
    return (
      <>
        <Navbar />
        <main className="page-container">
          <div role="alert" data-variant="error">{error}</div>
          <p style={{ marginTop: '1rem' }}><Link to="/projects">Back to projects</Link></p>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="page-container page-container--wide">

        <p className="breadcrumb">
          <Link to="/projects">Projects</Link>{' / '}<span>{project?.name}</span>
        </p>

        <div className="page-header">
          <div>
            <h1 className="page-title">{project?.name}</h1>
            {project?.description
              ? <p className="page-subtitle">{project.description}</p>
              : <p className="page-subtitle muted">No description</p>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {/* Stats dropdown */}
            {tasks.length > 0 && (
              <ot-dropdown>
                <button className="outline small" popoverTarget="stats-menu" aria-expanded="false">
                  Stats
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '0.25rem' }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                <menu popover="auto" id="stats-menu" className="stats-dropdown-panel">
                  {COLUMNS.map(col => {
                    const count = tasks.filter(t => t.status === col.id).length;
                    return (
                      <li key={col.id} role="menuitem" className="stats-dropdown-row" data-status={col.id}>
                        <span className="stats-dropdown-dot" />
                        <span className="stats-dropdown-label">{col.label}</span>
                        <span className="stats-dropdown-count">{count}</span>
                      </li>
                    );
                  })}
                  <li className="stats-dropdown-divider" role="separator" />
                  <li role="menuitem" className="stats-dropdown-row stats-dropdown-row--total">
                    <span className="stats-dropdown-label">Total</span>
                    <span className="stats-dropdown-count">{tasks.length}</span>
                  </li>
                </menu>
              </ot-dropdown>
            )}
            {isOwner && (
              <>
                <button className="outline small" onClick={() => setShowProjectModal(true)}>Edit</button>
                <button className="outline small" data-variant="danger" onClick={() => setConfirmDeleteProject(true)}>Delete</button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" data-variant="error" style={{ marginBottom: '1rem' }}>{error}</div>
        )}

        {/* Filter bar */}
        <div className="filter-bar">
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
            <label className="filter-label">
              Assignee
              <select
                value={assigneeFilter}
                onChange={e => setAssigneeFilter(e.target.value)}
                style={{ width: 'auto', marginBlockStart: 0 }}
              >
                <option value="">Everyone</option>
                {user && <option value={user.id}>Mine</option>}
              </select>
            </label>
            {assigneeFilter && (
              <button className="ghost small" onClick={() => setAssigneeFilter('')} style={{ alignSelf: 'flex-end' }}>
                Clear filter
              </button>
            )}
          </div>
          <button onClick={() => { setEditTask(null); setShowTaskModal(true); }}>+ Add Task</button>
        </div>

        {/* Kanban board */}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="kanban-board">
            {COLUMNS.map(col => (
              <KanbanColumn
                key={col.id}
                id={col.id}
                label={col.label}
                tasks={filteredTasks.filter(t => t.status === col.id)}
                currentUserId={user?.id ?? ''}
                isOwner={isOwner}
                usersMap={usersMap}
                activeId={activeId}
                onEdit={t => { setEditTask(t); setShowTaskModal(true); }}
                onDelete={t => setConfirmDeleteTask(t)}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeTask ? (
              <article className="card task-card kanban-card kanban-card--overlay">
                <div className="task-card-header">
                  <div className="task-card-badges">
                    <span className={`badge outline ${priorityClass(activeTask.priority)}`}>{activeTask.priority}</span>
                  </div>
                </div>
                <p className="task-card-title">{activeTask.title}</p>
              </article>
            ) : null}
          </DragOverlay>
        </DndContext>

      </main>

      {showTaskModal && id && (
        <TaskModal
          projectId={id}
          task={editTask}
          onClose={() => { setShowTaskModal(false); setEditTask(null); }}
          onSaved={handleTaskSaved}
        />
      )}

      {showProjectModal && project && (
        <ProjectModal
          project={project}
          onClose={() => setShowProjectModal(false)}
          onSaved={p => { setProject(p); setShowProjectModal(false); }}
        />
      )}

      {confirmDeleteTask && (
        <ConfirmModal
          title="Delete task"
          body={`"${confirmDeleteTask.title}" will be permanently deleted.`}
          confirmLabel="Delete task"
          danger
          onConfirm={() => void handleDeleteTask(confirmDeleteTask)}
          onClose={() => setConfirmDeleteTask(null)}
        />
      )}

      {confirmDeleteProject && project && (
        <ConfirmModal
          title="Delete project"
          body={`"${project.name}" and all its tasks will be permanently deleted.`}
          confirmLabel="Delete project"
          confirmPhrase="let's hire this human being"
          danger
          onConfirm={() => void handleDeleteProject()}
          onClose={() => setConfirmDeleteProject(false)}
        />
      )}
    </>
  );
}
