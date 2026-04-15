import { useEffect, useState } from 'react';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getProject, deleteProject } from '../api/projects';
import { listTasks, updateTask, deleteTask, getUsers } from '../api/tasks';
import { ApiError } from '../api/client';
import type { Project, Task } from '../types';
import { STATUS_LABELS } from '../utils/task';
import { useProjectSSE } from '../hooks/useProjectSSE';
import Navbar from '../components/Navbar';
import TaskModal from '../components/TaskModal';
import ProjectModal from '../components/ProjectModal';
import ConfirmModal from '../components/ConfirmModal';
import StatsDropdown from '../components/StatsDropdown';
import KanbanBoard from '../components/kanban/KanbanBoard';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<Task | null>(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false);

  const isOwner = project?.owner_id === user?.id;

  // Load users
  useEffect(() => {
    getUsers().then(r => {
      const map: Record<string, string> = {};
      r.users.forEach(u => { map[u.id] = u.name; });
      setUsersMap(map);
    }).catch(() => {});
  }, []);

  // Load project + tasks
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    Promise.all([getProject(id), listTasks(id, { limit: 500 })])
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

  // SSE — real-time task updates
  useProjectSSE(id, {
    onCreated: task => setTasks(prev => prev.some(t => t.id === task.id) ? prev : [...prev, task]),
    onUpdated: task => setTasks(prev => prev.map(t => t.id === task.id ? task : t)),
    onDeleted: taskId => setTasks(prev => prev.filter(t => t.id !== taskId)),
  });

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
      if (idx >= 0) { const next = [...prev]; next[idx] = savedTask; return next; }
      return [...prev, savedTask];
    });
    setEditTask(null);
    setShowTaskModal(false);
    if (isNew) success(`"${savedTask.title}" created`);
    else success('Task updated');
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

  const filteredTasks = assigneeFilter
    ? tasks.filter(t => t.assignee_id === assigneeFilter)
    : tasks;

  // ── Loading / error states ─────────────────────────────────────────────────

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

  // ── Main render ────────────────────────────────────────────────────────────

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
            <StatsDropdown tasks={tasks} />
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
        <KanbanBoard
          tasks={filteredTasks}
          currentUserId={user?.id ?? ''}
          isOwner={isOwner}
          usersMap={usersMap}
          activeId={activeId}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onEdit={t => { setEditTask(t); setShowTaskModal(true); }}
          onDelete={t => setConfirmDeleteTask(t)}
        />

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
