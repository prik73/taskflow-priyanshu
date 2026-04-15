import { useEffect, useRef, useState } from 'react';
import type { Project } from '../types';
import { ApiError } from '../api/client';
import { createProject, updateProject, checkProjectName } from '../api/projects';

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
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [checkingName, setCheckingName] = useState(false);

  const isEdit = project != null;

  useEffect(() => {
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, []);

  // Debounced name availability check
  useEffect(() => {
    const trimmed = name.trim();
    // Skip check if name is empty or unchanged from current project name
    if (!trimmed || (isEdit && trimmed.toLowerCase() === project.name.toLowerCase())) {
      setNameAvailable(null);
      setCheckingName(false);
      return;
    }
    setCheckingName(true);
    setNameAvailable(null);
    const t = setTimeout(async () => {
      try {
        const res = await checkProjectName(trimmed, isEdit ? project.id : undefined);
        setNameAvailable(res.available);
      } catch {
        setNameAvailable(null);
      } finally {
        setCheckingName(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [name, isEdit, project?.id, project?.name]);

  function handleClose() {
    dialogRef.current?.close();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (nameAvailable === false) return; // block submit if name taken
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

  const nameChanged = name.trim().toLowerCase() !== (project?.name ?? '').toLowerCase();
  const showNameStatus = nameChanged && name.trim().length > 0;

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

          <div data-field={fieldErrors.name || nameAvailable === false ? 'error' : undefined}>
            <label htmlFor="proj-name">
              Project name <span aria-hidden="true">*</span>
              <div style={{ position: 'relative' }}>
                <input
                  id="proj-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Website Redesign"
                  required
                  maxLength={200}
                  autoFocus
                  aria-invalid={!!fieldErrors.name || nameAvailable === false}
                  style={{ paddingRight: showNameStatus ? '2rem' : undefined }}
                />
                {showNameStatus && (
                  <span className="name-check-indicator" aria-live="polite">
                    {checkingName ? (
                      <span className="name-check-spinner" />
                    ) : nameAvailable === true ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : nameAvailable === false ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    ) : null}
                  </span>
                )}
              </div>
            </label>
            {fieldErrors.name && <p className="error">{fieldErrors.name}</p>}
            {!fieldErrors.name && nameAvailable === false && (
              <p className="error">A project with this name already exists.</p>
            )}
            {!fieldErrors.name && nameAvailable === true && (
              <p className="field-hint success">Name is available.</p>
            )}
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
          <button
            type="submit"
            disabled={loading || nameAvailable === false || checkingName}
            aria-busy={loading || undefined}
          >
            {loading ? '' : isEdit ? 'Save changes' : 'Create project'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
