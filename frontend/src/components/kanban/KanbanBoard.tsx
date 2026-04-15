import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { Task } from '../../types';
import { COLUMNS, priorityClass } from '../../utils/task';
import KanbanColumn from './KanbanColumn';

interface KanbanBoardProps {
  tasks: Task[];
  currentUserId: string;
  isOwner: boolean;
  usersMap: Record<string, string>;
  activeId: string | null;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export default function KanbanBoard({ tasks, currentUserId, isOwner, usersMap, activeId, onDragStart, onDragEnd, onEdit, onDelete }: KanbanBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="kanban-scroll-wrapper">
      <div className="kanban-board">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            label={col.label}
            tasks={tasks.filter(t => t.status === col.id)}
            currentUserId={currentUserId}
            isOwner={isOwner}
            usersMap={usersMap}
            activeId={activeId}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
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
  );
}
