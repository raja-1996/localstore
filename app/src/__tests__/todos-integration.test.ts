/**
 * Frontend integration tests for /api/v1/todos endpoints.
 *
 * Uses a standalone axios instance — does NOT import ../lib/api because
 * expo-secure-store is unavailable in a node test environment.
 *
 * Opt-in: only runs when RUN_INTEGRATION=true
 *   RUN_INTEGRATION=true npx jest todos-integration
 *
 * Env vars (all optional, fall back to test defaults):
 *   TEST_API_URL   — base URL of the running backend (default: http://localhost:8000)
 *   TEST_EMAIL     — email of an existing test user   (default: todo-test@example.com)
 *   TEST_PASSWORD  — password for that user           (default: TestPass123!)
 */

import axios, { AxiosInstance } from 'axios';
import type { Todo } from '../services/todos-service';

const API_URL = process.env.TEST_API_URL || 'http://localhost:8000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'todo-test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'TestPass123!';
const NONEXISTENT_ID = '00000000-0000-0000-0000-000000000000';

// All integration tests are opt-in via RUN_INTEGRATION=true
const describeIntegration = process.env.RUN_INTEGRATION === 'true' ? describe : describe.skip;

let authedClient: AxiosInstance;
let anonClient: AxiosInstance;
let currentUserId: string;
let loginFailed = false;

// ------------------------------------------------------------------
// Setup: login and build axios instances
// ------------------------------------------------------------------

describeIntegration('Todos Integration', () => {
  beforeAll(async () => {
    anonClient = axios.create({
      baseURL: `${API_URL}/api/v1`,
      timeout: 3000,
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
    });

    const loginResp = await anonClient.post('/auth/login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (loginResp.status !== 200) {
      loginFailed = true;
      throw new Error(
        `[todos-integration] Login failed (status ${loginResp.status}). ` +
        `Check TEST_EMAIL/TEST_PASSWORD and that the backend is running at ${API_URL}.`
      );
    }

    const { access_token, user } = loginResp.data;
    currentUserId = user.id;

    authedClient = axios.create({
      baseURL: `${API_URL}/api/v1`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      validateStatus: () => true,
    });
  });

  beforeEach(() => {
    if (loginFailed) return;
  });

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  async function createTodo(title: string, description?: string): Promise<Todo> {
    const body: { title: string; description?: string } = { title };
    if (description !== undefined) body.description = description;
    const resp = await authedClient.post<Todo>('/todos', body);
    if (resp.status !== 201) {
      throw new Error(`createTodo failed with status ${resp.status}`);
    }
    return resp.data;
  }

  async function deleteTodo(id: string): Promise<void> {
    const resp = await authedClient.delete(`/todos/${id}`);
    if (resp.status !== 204) {
      console.warn(`[todos-integration] deleteTodo(${id}) returned ${resp.status}, expected 204`);
    }
  }

  // ------------------------------------------------------------------
  // Create
  // ------------------------------------------------------------------

  describe('POST /todos — create', () => {
    test('creates todo with title and description', async () => {
      const resp = await authedClient.post<Todo>('/todos', {
        title: 'Buy groceries',
        description: 'Milk, eggs, bread',
      });

      let data: Todo | undefined;
      try {
        expect(resp.status).toBe(201);
        data = resp.data;
        expect(data.title).toBe('Buy groceries');
        expect(data.description).toBe('Milk, eggs, bread');
        expect(data.is_completed).toBe(false);
        expect(data.user_id).toBe(currentUserId);
        expect(data.id).toBeTruthy();
        expect(data.created_at).toBeTruthy();
        expect(data.updated_at).toBeTruthy();
      } finally {
        if (data?.id) await deleteTodo(data.id);
      }
    });

    test('creates todo with default (empty) description', async () => {
      const resp = await authedClient.post<Todo>('/todos', {
        title: 'No description todo',
      });

      try {
        expect(resp.status).toBe(201);
        expect(resp.data.description).toBe('');
      } finally {
        if (resp.data?.id) await deleteTodo(resp.data.id);
      }
    });

    test('missing title returns 422', async () => {
      const resp = await authedClient.post('/todos', { description: 'No title' });
      expect(resp.status).toBe(422);
    });

    // FastAPI treats missing Authorization header as a required field validation failure → 422
    test('unauthenticated request returns 422', async () => {
      const resp = await anonClient.post('/todos', { title: 'Unauthorized' });
      expect(resp.status).toBe(422);
    });
  });

  // ------------------------------------------------------------------
  // List
  // ------------------------------------------------------------------

  describe('GET /todos — list', () => {
    let sharedTodo: Todo;

    beforeAll(async () => {
      sharedTodo = await createTodo('List test todo', 'for list tests');
    });

    afterAll(async () => {
      if (sharedTodo) await deleteTodo(sharedTodo.id);
    });

    test('returns an array containing the created todo', async () => {
      const resp = await authedClient.get<Todo[]>('/todos');

      expect(resp.status).toBe(200);
      expect(Array.isArray(resp.data)).toBe(true);
      expect(resp.data.map((t) => t.id)).toContain(sharedTodo.id);
      const found = resp.data.find((t) => t.id === sharedTodo.id);
      expect(found).toMatchObject({
        title: 'List test todo',
        is_completed: false,
        user_id: currentUserId,
      });
    });

    test('all returned todos belong to the authenticated user', async () => {
      const resp = await authedClient.get<Todo[]>('/todos');

      expect(resp.status).toBe(200);
      for (const todo of resp.data) {
        expect(todo.user_id).toBe(currentUserId);
      }
    });

    // FastAPI treats missing Authorization header as a required field validation failure → 422
    test('unauthenticated request returns 422', async () => {
      const resp = await anonClient.get('/todos');
      expect(resp.status).toBe(422);
    });

    test('returns todos ordered by created_at desc', async () => {
      let first: Todo | undefined;
      let second: Todo | undefined;

      try {
        first = await createTodo('Ordering test todo A');
        await new Promise((r) => setTimeout(r, 50));
        second = await createTodo('Ordering test todo B');

        const resp = await authedClient.get<Todo[]>('/todos');

        expect(resp.status).toBe(200);
        const ids = resp.data.map((t) => t.id);
        const firstIdx = ids.indexOf(first.id);
        const secondIdx = ids.indexOf(second.id);
        // second was created later — should appear before first
        expect(secondIdx).toBeLessThan(firstIdx);
      } finally {
        if (first) await deleteTodo(first.id);
        if (second) await deleteTodo(second.id);
      }
    });
  });

  // ------------------------------------------------------------------
  // Get
  // ------------------------------------------------------------------

  describe('GET /todos/:id — get by id', () => {
    let todo: Todo;

    beforeAll(async () => {
      todo = await createTodo('Get test todo', 'fixture for get tests');
    });

    afterAll(async () => {
      if (todo) await deleteTodo(todo.id);
    });

    test('returns the correct todo by id', async () => {
      const resp = await authedClient.get<Todo>(`/todos/${todo.id}`);

      expect(resp.status).toBe(200);
      expect(resp.data.id).toBe(todo.id);
      expect(resp.data.title).toBe(todo.title);
    });

    test('nonexistent id returns 404', async () => {
      const resp = await authedClient.get(`/todos/${NONEXISTENT_ID}`);
      expect(resp.status).toBe(404);
    });

    // FastAPI treats missing Authorization header as a required field validation failure → 422
    test('unauthenticated request returns 422', async () => {
      const resp = await anonClient.get(`/todos/${todo.id}`);
      expect(resp.status).toBe(422);
    });
  });

  // ------------------------------------------------------------------
  // Update
  // ------------------------------------------------------------------

  describe('PATCH /todos/:id — update', () => {
    let todo: Todo;

    beforeEach(async () => {
      todo = await createTodo('Update test todo', 'fixture for update tests');
    });

    afterEach(async () => {
      if (todo) await deleteTodo(todo.id);
    });

    test('updates title', async () => {
      const resp = await authedClient.patch<Todo>(`/todos/${todo.id}`, {
        title: 'Updated title',
      });

      expect(resp.status).toBe(200);
      expect(resp.data.title).toBe('Updated title');
    });

    test('marks todo as completed', async () => {
      const resp = await authedClient.patch<Todo>(`/todos/${todo.id}`, {
        is_completed: true,
      });

      expect(resp.status).toBe(200);
      expect(resp.data.is_completed).toBe(true);
    });

    test('updates multiple fields at once', async () => {
      const resp = await authedClient.patch<Todo>(`/todos/${todo.id}`, {
        title: 'New title',
        description: 'New desc',
        is_completed: true,
      });

      expect(resp.status).toBe(200);
      expect(resp.data.title).toBe('New title');
      expect(resp.data.description).toBe('New desc');
      expect(resp.data.is_completed).toBe(true);
    });

    test('updated_at changes after PATCH', async () => {
      const originalUpdatedAt = todo.updated_at;

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const resp = await authedClient.patch<Todo>(`/todos/${todo.id}`, {
        title: 'Timestamp check',
      });

      expect(resp.status).toBe(200);
      expect(resp.data.updated_at).not.toBe(originalUpdatedAt);
    });

    test('empty body returns 400 with "No fields to update"', async () => {
      const resp = await authedClient.patch(`/todos/${todo.id}`, {});

      expect(resp.status).toBe(400);
      expect(resp.data.detail).toBe('No fields to update');
    });

    test('nonexistent id returns 404', async () => {
      const resp = await authedClient.patch(`/todos/${NONEXISTENT_ID}`, {
        title: 'Ghost update',
      });
      expect(resp.status).toBe(404);
    });

    test('sets image_path to a string value', async () => {
      const resp = await authedClient.patch<Todo>(`/todos/${todo.id}`, {
        image_path: 'uploads/img.jpg',
      });
      expect(resp.status).toBe(200);
      expect(resp.data.image_path).toBe('uploads/img.jpg');
    });

    test('image_path: null returns 400 (backend uses exclude_none=True, strips null fields)', async () => {
      // Backend: model_dump(exclude_none=True) strips null values → empty update body → 400.
      // Clearing image_path is not supported via PATCH at this time.
      const resp = await authedClient.patch(`/todos/${todo.id}`, { image_path: null });
      expect(resp.status).toBe(400);
      expect(resp.data.detail).toBe('No fields to update');
    });
  });

  // ------------------------------------------------------------------
  // Delete
  // ------------------------------------------------------------------

  describe('DELETE /todos/:id — delete', () => {
    test('deletes todo and verifies it is gone with 404', async () => {
      const todo = await createTodo('To be deleted');

      const delResp = await authedClient.delete(`/todos/${todo.id}`);
      expect(delResp.status).toBe(204);

      const getResp = await authedClient.get(`/todos/${todo.id}`);
      expect(getResp.status).toBe(404);
      expect(getResp.data.detail).toBeTruthy();
    });

    test('nonexistent id returns 404', async () => {
      const resp = await authedClient.delete(`/todos/${NONEXISTENT_ID}`);
      expect(resp.status).toBe(404);
    });

    // FastAPI treats missing Authorization header as a required field validation failure → 422
    test('unauthenticated request returns 422', async () => {
      const todo = await createTodo('Auth-delete test todo');

      try {
        const resp = await anonClient.delete(`/todos/${todo.id}`);
        expect(resp.status).toBe(422);
      } finally {
        await deleteTodo(todo.id);
      }
    });
  });

  afterAll(async () => {
    if (!authedClient) return;
    const resp = await authedClient.get<Todo[]>('/todos');
    if (resp.status === 200) {
      await Promise.all(resp.data.map((t) => deleteTodo(t.id)));
    }
  });
});
