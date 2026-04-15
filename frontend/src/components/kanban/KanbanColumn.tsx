import { useDroppable } from '@dnd-kit/core';
import type { Task } from '../../types';
import TaskCard from './TaskCard';

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

export default function KanbanColumn({ id, label, tasks, currentUserId, isOwner, usersMap, activeId, onEdit, onDelete }: KanbanColumnProps) {
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
