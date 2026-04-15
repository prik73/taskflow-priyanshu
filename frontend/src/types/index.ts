export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
  updated_at?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'need_review' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  project_id: string;
  assignee_id: string | null;
  creator_id: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithTasks extends Project {
  tasks: Task[];
}

export interface PaginatedProjects {
  projects: Project[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedTasks {
  tasks: Task[];
  total: number;
  page: number;
  limit: number;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface ApiErrorBody {
  error: string;
  fields?: Record<string, string>;
}

export interface ProjectStats {
  by_status: { status: string; count: number }[];
  by_assignee: { assignee_id: string; assignee_name: string; count: number }[];
}
