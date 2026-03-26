import { useTodos, useTodo, useCreateTodo, useUpdateTodo, useDeleteTodo } from '../hooks/use-todos';
import todosService from '../services/todos-service';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

jest.mock('../services/todos-service', () => ({
  __esModule: true,
  default: {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockTodosService = todosService as jest.Mocked<typeof todosService>;

// Capture args passed to useQuery / useMutation
let capturedQueryOptions: Record<string, any>[] = [];
let capturedMutationOptions: Record<string, any>[] = [];
const mockInvalidateQueries = jest.fn();
const mockQueryClient = { invalidateQueries: mockInvalidateQueries };

jest.mock('@tanstack/react-query', () => {
  const useQuery = jest.fn();
  const useMutation = jest.fn();
  const useQueryClient = jest.fn();
  return { useQuery, useMutation, useQueryClient };
});

const mockTodo = {
  id: 'todo-1',
  user_id: 'user-1',
  title: 'Buy groceries',
  description: 'Milk, eggs',
  image_path: null,
  is_completed: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('use-todos hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedQueryOptions = [];
    capturedMutationOptions = [];
    (useQuery as jest.Mock).mockImplementation((options: any) => {
      capturedQueryOptions.push(options);
      return { data: undefined, isLoading: false };
    });
    (useMutation as jest.Mock).mockImplementation((options: any) => {
      capturedMutationOptions.push(options);
      return { mutate: jest.fn(), isPending: false };
    });
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClient);
  });

  describe('useTodos', () => {
    it('passes queryKey ["todos"]', () => {
      useTodos();
      expect(capturedQueryOptions[0].queryKey).toEqual(['todos']);
    });

    it('queryFn calls todosService.list and returns data', async () => {
      mockTodosService.list.mockResolvedValueOnce({ data: [mockTodo] } as any);
      useTodos();
      const result = await capturedQueryOptions[0].queryFn();
      expect(mockTodosService.list).toHaveBeenCalledTimes(1);
      expect(result).toEqual([mockTodo]);
      expect(result).not.toHaveProperty('data');
    });

    it('queryFn rejects when todosService.list rejects', async () => {
      mockTodosService.list.mockRejectedValueOnce(new Error('Network error'));
      useTodos();
      await expect(capturedQueryOptions[0].queryFn()).rejects.toThrow('Network error');
    });
  });

  describe('useTodo', () => {
    it('passes queryKey ["todos", id]', () => {
      useTodo('todo-1');
      expect(capturedQueryOptions[0].queryKey).toEqual(['todos', 'todo-1']);
    });

    it('is enabled when id is provided', () => {
      useTodo('todo-1');
      expect(capturedQueryOptions[0].enabled).toBe(true);
    });

    it('is disabled when id is empty string', () => {
      useTodo('');
      expect(capturedQueryOptions[0].enabled).toBe(false);
    });

    it('is disabled when id is null', () => {
      useTodo(null as any);
      expect(capturedQueryOptions[0].enabled).toBe(false);
    });

    it('is disabled when id is undefined', () => {
      useTodo(undefined as any);
      expect(capturedQueryOptions[0].enabled).toBe(false);
    });

    it('queryFn calls todosService.get with correct id and returns data', async () => {
      mockTodosService.get.mockResolvedValueOnce({ data: mockTodo } as any);
      useTodo('todo-1');
      const result = await capturedQueryOptions[0].queryFn();
      expect(mockTodosService.get).toHaveBeenCalledWith('todo-1');
      expect(result).toEqual(mockTodo);
    });

    it('queryFn rejects when todosService.get rejects', async () => {
      mockTodosService.get.mockRejectedValueOnce(new Error('Not found'));
      useTodo('todo-1');
      await expect(capturedQueryOptions[0].queryFn()).rejects.toThrow('Not found');
    });
  });

  describe('useCreateTodo', () => {
    it('mutationFn calls todosService.create with correct payload and returns todo', async () => {
      const payload = { title: 'Buy groceries', description: 'Milk' };
      mockTodosService.create.mockResolvedValueOnce({ data: mockTodo } as any);
      useCreateTodo();
      const result = await capturedMutationOptions[0].mutationFn(payload);
      expect(mockTodosService.create).toHaveBeenCalledWith(payload);
      expect(result).toEqual(mockTodo);
    });

    it('mutationFn rejects when todosService.create rejects', async () => {
      mockTodosService.create.mockRejectedValueOnce(new Error('Validation error'));
      useCreateTodo();
      await expect(capturedMutationOptions[0].mutationFn({ title: '' })).rejects.toThrow(
        'Validation error'
      );
    });

    it('onSuccess calls queryClient.invalidateQueries with { queryKey: ["todos"] }', () => {
      useCreateTodo();
      capturedMutationOptions[0].onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['todos'] });
    });

    it('has no onError handler defined', () => {
      useCreateTodo();
      expect(capturedMutationOptions[0].onError).toBeUndefined();
    });
  });

  describe('useUpdateTodo', () => {
    it('mutationFn calls todosService.update with correct id and data and returns todo', async () => {
      const updateData = { is_completed: true };
      mockTodosService.update.mockResolvedValueOnce({ data: mockTodo } as any);
      useUpdateTodo();
      const result = await capturedMutationOptions[0].mutationFn({ id: 'todo-1', data: updateData });
      expect(mockTodosService.update).toHaveBeenCalledWith('todo-1', updateData);
      expect(result).toEqual(mockTodo);
    });

    it('mutationFn rejects when todosService.update rejects', async () => {
      mockTodosService.update.mockRejectedValueOnce(new Error('Not found'));
      useUpdateTodo();
      await expect(
        capturedMutationOptions[0].mutationFn({ id: 'bad-id', data: { title: 'x' } })
      ).rejects.toThrow('Not found');
    });

    it('onSuccess calls queryClient.invalidateQueries with { queryKey: ["todos"] }', () => {
      useUpdateTodo();
      capturedMutationOptions[0].onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['todos'] });
    });

    // TanStack Query's hierarchical invalidation: invalidating ['todos'] also stales all ['todos', id] entries
    it('onSuccess does NOT invalidate individual ["todos", id] key — list invalidation only', () => {
      useUpdateTodo();
      capturedMutationOptions[0].onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
      const call = mockInvalidateQueries.mock.calls[0][0];
      expect(call.queryKey).toHaveLength(1);
      expect(call.queryKey[0]).toBe('todos');
    });
  });

  describe('useDeleteTodo', () => {
    it('mutationFn calls todosService.delete with correct id', async () => {
      mockTodosService.delete.mockResolvedValueOnce({ data: {} } as any);
      useDeleteTodo();
      await capturedMutationOptions[0].mutationFn('todo-1');
      expect(mockTodosService.delete).toHaveBeenCalledWith('todo-1');
    });

    it('mutationFn discards delete response and resolves void (intentional)', async () => {
      mockTodosService.delete.mockResolvedValueOnce({ data: {} } as any);
      useDeleteTodo();
      const result = await capturedMutationOptions[0].mutationFn('todo-1');
      expect(result).toBeUndefined();
    });

    it('mutationFn rejects when todosService.delete rejects', async () => {
      mockTodosService.delete.mockRejectedValueOnce(new Error('Forbidden'));
      useDeleteTodo();
      await expect(capturedMutationOptions[0].mutationFn('todo-1')).rejects.toThrow('Forbidden');
    });

    it('onSuccess calls queryClient.invalidateQueries with { queryKey: ["todos"] }', () => {
      useDeleteTodo();
      capturedMutationOptions[0].onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['todos'] });
    });
  });
});
