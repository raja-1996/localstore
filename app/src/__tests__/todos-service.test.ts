import todosService from '../services/todos-service';
import api from '../lib/api';

jest.mock('../lib/api', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
}));

const mockApi = api as jest.Mocked<typeof api>;

const mockTodo = Object.freeze({
  id: 'todo-1',
  user_id: 'user-1',
  title: 'Buy groceries',
  description: 'Milk, eggs, bread',
  image_path: null,
  is_completed: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
});

const mockTodoResponse = { data: mockTodo };
const mockTodosResponse = { data: [mockTodo] };

describe('todosService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('calls GET /todos', async () => {
      mockApi.get.mockResolvedValueOnce(mockTodosResponse);
      await todosService.list();
      expect(mockApi.get).toHaveBeenCalledWith('/todos');
    });

    it('returns list of todos on success', async () => {
      mockApi.get.mockResolvedValueOnce(mockTodosResponse);
      const result = await todosService.list();
      expect(result.data).toEqual([mockTodo]);
    });

    it('returns empty list when API returns no todos', async () => {
      mockApi.get.mockResolvedValueOnce({ data: [] });
      const result = await todosService.list();
      expect(result.data).toHaveLength(0);
    });

    it('rejects when API returns an error', async () => {
      const error = { response: { status: 500 } };
      mockApi.get.mockRejectedValueOnce(error);
      await expect(todosService.list()).rejects.toMatchObject({ response: { status: 500 } });
    });
  });

  describe('get', () => {
    it('calls GET /todos/:id with correct id', async () => {
      mockApi.get.mockResolvedValueOnce(mockTodoResponse);
      await todosService.get('todo-1');
      expect(mockApi.get).toHaveBeenCalledWith('/todos/todo-1');
    });

    it('returns single todo on success', async () => {
      mockApi.get.mockResolvedValueOnce(mockTodoResponse);
      const result = await todosService.get('todo-1');
      expect(result.data).toEqual(mockTodo);
    });

    it('rejects when todo is not found', async () => {
      const error = { response: { status: 404, data: { detail: 'Todo not found' } } };
      mockApi.get.mockRejectedValueOnce(error);
      await expect(todosService.get('nonexistent')).rejects.toMatchObject({
        response: { status: 404 },
      });
    });
  });

  describe('create', () => {
    it('calls POST /todos with correct payload', async () => {
      mockApi.post.mockResolvedValueOnce(mockTodoResponse);
      await todosService.create({ title: 'Buy groceries', description: 'Milk, eggs, bread' });
      expect(mockApi.post).toHaveBeenCalledWith('/todos', {
        title: 'Buy groceries',
        description: 'Milk, eggs, bread',
      });
    });

    it('calls POST /todos with title only (description optional)', async () => {
      mockApi.post.mockResolvedValueOnce(mockTodoResponse);
      await todosService.create({ title: 'Buy groceries' });
      expect(mockApi.post).toHaveBeenCalledWith('/todos', { title: 'Buy groceries' });
    });

    it('returns created todo on success', async () => {
      mockApi.post.mockResolvedValueOnce(mockTodoResponse);
      const result = await todosService.create({ title: 'Buy groceries' });
      expect(result.data).toEqual(mockTodo);
    });

    it('rejects when API returns an error', async () => {
      const error = { response: { status: 500 } };
      mockApi.post.mockRejectedValueOnce(error);
      await expect(todosService.create({ title: 'Buy groceries' })).rejects.toMatchObject({
        response: { status: 500 },
      });
    });
  });

  describe('update', () => {
    it('calls PATCH /todos/:id with correct id and payload', async () => {
      mockApi.patch.mockResolvedValueOnce(mockTodoResponse);
      await todosService.update('todo-1', { is_completed: true });
      expect(mockApi.patch).toHaveBeenCalledWith('/todos/todo-1', { is_completed: true });
    });

    it('calls PATCH /todos/:id with partial update payload', async () => {
      mockApi.patch.mockResolvedValueOnce(mockTodoResponse);
      await todosService.update('todo-1', { title: 'Updated title', description: 'New desc' });
      expect(mockApi.patch).toHaveBeenCalledWith('/todos/todo-1', {
        title: 'Updated title',
        description: 'New desc',
      });
    });

    it('returns updated todo on success', async () => {
      const updated = { ...mockTodo, is_completed: true };
      mockApi.patch.mockResolvedValueOnce({ data: updated });
      const result = await todosService.update('todo-1', { is_completed: true });
      expect(result.data.is_completed).toBe(true);
    });

    it('rejects when API returns an error', async () => {
      const error = { response: { status: 404 } };
      mockApi.patch.mockRejectedValueOnce(error);
      await expect(todosService.update('bad-id', { title: 'x' })).rejects.toMatchObject({
        response: { status: 404 },
      });
    });

    it('calls PATCH /todos/:id with image_path string', async () => {
      mockApi.patch.mockResolvedValueOnce(mockTodoResponse);
      await todosService.update('todo-1', { image_path: 'uploads/img.jpg' });
      expect(mockApi.patch).toHaveBeenCalledWith('/todos/todo-1', { image_path: 'uploads/img.jpg' });
    });

    it('calls PATCH /todos/:id with image_path null', async () => {
      mockApi.patch.mockResolvedValueOnce(mockTodoResponse);
      await todosService.update('todo-1', { image_path: null });
      expect(mockApi.patch).toHaveBeenCalledWith('/todos/todo-1', { image_path: null });
    });

    it('calls PATCH /todos/:id with empty object payload', async () => {
      mockApi.patch.mockResolvedValueOnce(mockTodoResponse);
      await todosService.update('todo-1', {});
      expect(mockApi.patch).toHaveBeenCalledWith('/todos/todo-1', {});
    });
  });

  describe('delete', () => {
    it('calls DELETE /todos/:id with correct id', async () => {
      mockApi.delete.mockResolvedValueOnce(undefined);
      await todosService.delete('todo-1');
      expect(mockApi.delete).toHaveBeenCalledWith('/todos/todo-1');
    });

    it('resolves with the API response on successful deletion', async () => {
      mockApi.delete.mockResolvedValueOnce(undefined);
      const result = await todosService.delete('todo-1');
      expect(result).toBeUndefined();
    });

    it('rejects when API returns an error', async () => {
      const error = { response: { status: 403 } };
      mockApi.delete.mockRejectedValueOnce(error);
      await expect(todosService.delete('todo-1')).rejects.toMatchObject({
        response: { status: 403 },
      });
    });
  });
});
