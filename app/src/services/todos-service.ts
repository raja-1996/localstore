import api from '../lib/api';

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  description: string;
  image_path: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface TodoCreate {
  title: string;
  description?: string;
}

export interface TodoUpdate {
  title?: string;
  description?: string;
  is_completed?: boolean;
  image_path?: string | null;
}

const todosService = {
  list: () => api.get<Todo[]>('/todos'),
  get: (id: string) => api.get<Todo>(`/todos/${id}`),
  create: (data: TodoCreate) => api.post<Todo>('/todos', data),
  update: (id: string, data: TodoUpdate) => api.patch<Todo>(`/todos/${id}`, data),
  delete: (id: string) => api.delete(`/todos/${id}`),
};

export default todosService;
