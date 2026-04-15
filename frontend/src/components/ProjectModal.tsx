import { useEffect, useRef, useState } from 'react';
import type { Project } from '../types';
import { ApiError } from '../api/client';
import { createProject, updateProject } from '../api/projects';

interface Props {
  project?: Project | null;
  onClose: () => void;
  onSaved: (project: Project) => void;
}

export default function ProjectModal({ project, onClose, onSaved }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isEdit = project != null;

  useEffect(() => {
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, []);

  function handleClose() {
    dialogRef.current?.close();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);
    try {
      const saved = isEdit
        ? await updateProject(project.id, name.trim(), description.trim())
        : await createProject(name.trim(), description.trim());
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
          <h2>{isEdit ? 'Edit Project' : 'New Project'}</h2>
        </header>

        <div>
          {error && (
            <div role="alert" data-variant="error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <div data-field={fieldErrors.name ? 'error' : undefined}>
            <label htmlFor="proj-name">
              Project name <span aria-hidden="true">*</span>
              <input
                id="proj-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Website Redesign"
                required
                maxLength={200}
                autoFocus
                aria-invalid={!!fieldErrors.name}
              />
            </label>
            {fieldErrors.name && <p className="error">{fieldErrors.name}</p>}
          </div>

          <div data-field={fieldErrors.description ? 'error' : undefined}>
            <label htmlFor="proj-desc">
              Description
              <textarea
                id="proj-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional project description"
                rows={3}
                maxLength={2000}
              />
            </label>
            {fieldErrors.description && <p className="error">{fieldErrors.description}</p>}
          </div>
        </div>

        <footer>
          <button type="button" className="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" disabled={loading} aria-busy={loading || undefined}>
            {loading ? '' : isEdit ? 'Save changes' : 'Create project'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
