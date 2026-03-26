/**
 * @jest-environment node
 *
 * Frontend integration tests for /api/v1/storage endpoints.
 *
 * Uses a standalone axios instance — does NOT import ../lib/api because
 * expo-secure-store is unavailable in a node test environment.
 *
 * Uses the `form-data` npm package for multipart uploads in Node.js/Jest.
 *
 * Opt-in: only runs when RUN_INTEGRATION=true
 *   RUN_INTEGRATION=true npx jest storage-integration
 *
 * Env vars (all optional, fall back to test defaults):
 *   TEST_API_URL   — base URL of the running backend (default: http://localhost:8000)
 *   TEST_EMAIL     — email of an existing test user   (default: todo-test@example.com)
 *   TEST_PASSWORD  — password for that user           (default: TestPass123!)
 */

import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';

const API_URL = process.env.TEST_API_URL || 'http://localhost:8000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'todo-test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'TestPass123!';

// All integration tests are opt-in via RUN_INTEGRATION=true
const describeIntegration = process.env.RUN_INTEGRATION === 'true' ? describe : describe.skip;

let authedClient: AxiosInstance;
let anonClient: AxiosInstance;
let currentUserId: string;
let loginFailed = false;

// Track uploaded paths for afterAll cleanup safety-net
const uploadedPaths: string[] = [];

// ------------------------------------------------------------------
// Setup: login and build axios instances
// ------------------------------------------------------------------

describeIntegration('Storage Integration', () => {
  beforeAll(async () => {
    anonClient = axios.create({
      baseURL: `${API_URL}/api/v1`,
      timeout: 10000,
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
        `[storage-integration] Login failed (status ${loginResp.status}). ` +
        `Check TEST_EMAIL/TEST_PASSWORD and that the backend is running at ${API_URL}.`
      );
    }

    const { access_token, user } = loginResp.data;
    currentUserId = user.id;

    authedClient = axios.create({
      baseURL: `${API_URL}/api/v1`,
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      validateStatus: () => true,
    });
  });

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  function makeForm(filename = 'test.jpg', content = 'test image content'): FormData {
    const form = new FormData();
    const buffer = Buffer.from(content);
    form.append('file', buffer, { filename, contentType: 'image/jpeg' });
    return form;
  }

  async function uploadFile(filename = 'test.jpg', path?: string): Promise<string> {
    const form = makeForm(filename);
    if (path !== undefined) {
      form.append('path', path);
    }
    const resp = await authedClient.post('/storage/upload', form, {
      headers: { ...form.getHeaders() },
    });
    if (resp.status !== 200) {
      throw new Error(`uploadFile failed with status ${resp.status}: ${JSON.stringify(resp.data)}`);
    }
    const filePath: string = resp.data.path;
    uploadedPaths.push(filePath);
    return filePath;
  }

  async function deleteFile(path: string): Promise<void> {
    const resp = await authedClient.delete(`/storage/delete/${path}`);
    if (resp.status !== 204) {
      console.warn(`[storage-integration] deleteFile(${path}) returned ${resp.status}, expected 204`);
    }
    // Remove from tracking array
    const idx = uploadedPaths.indexOf(path);
    if (idx !== -1) uploadedPaths.splice(idx, 1);
  }

  // ------------------------------------------------------------------
  // Upload
  // ------------------------------------------------------------------

  describe('POST /storage/upload — upload', () => {
    test('uploads a file and response has { path, url } with user_id prefix', async () => {
      const form = makeForm();
      const resp = await authedClient.post('/storage/upload', form, {
        headers: { ...form.getHeaders() },
      });

      try {
        expect(resp.status).toBe(200);
        expect(resp.data).toHaveProperty('path');
        expect(resp.data).toHaveProperty('url');
        expect(typeof resp.data.path).toBe('string');
        expect(typeof resp.data.url).toBe('string');
        expect(resp.data.path).toContain(currentUserId);
      } finally {
        if (resp.data?.path) await deleteFile(resp.data.path);
      }
    });

    test('uploads with explicit path and that path is used', async () => {
      const explicitPath = `${currentUserId}/explicit-test.jpg`;
      const form = makeForm();
      form.append('path', explicitPath);

      const resp = await authedClient.post('/storage/upload', form, {
        headers: { ...form.getHeaders() },
      });

      try {
        expect(resp.status).toBe(200);
        expect(resp.data.path).toBe(explicitPath);
        expect(resp.data).toHaveProperty('url');
      } finally {
        if (resp.data?.path) await deleteFile(resp.data.path);
      }
    });

    // FastAPI treats missing Authorization header as a required field validation failure → 422
    test('unauthenticated upload returns 422', async () => {
      const form = makeForm();
      const resp = await anonClient.post('/storage/upload', form, {
        headers: { ...form.getHeaders() },
      });
      expect(resp.status).toBe(422);
    });
  });

  // ------------------------------------------------------------------
  // Download
  // ------------------------------------------------------------------

  describe('GET /storage/download/{path} — get signed URL', () => {
    let sharedFilePath: string;

    beforeAll(async () => {
      sharedFilePath = await uploadFile('download-test.jpg');
    });

    afterAll(async () => {
      if (sharedFilePath) await deleteFile(sharedFilePath);
    });

    test('returns { url } with a string URL for an uploaded file', async () => {
      const resp = await authedClient.get(`/storage/download/${sharedFilePath}`);

      expect(resp.status).toBe(200);
      expect(resp.data).toHaveProperty('url');
      expect(typeof resp.data.url).toBe('string');
      expect(resp.data.url.length).toBeGreaterThan(0);
    });

    test('nonexistent path returns 404', async () => {
      const resp = await authedClient.get(`/storage/download/${currentUserId}/nonexistent-file.jpg`);
      expect(resp.status).toBe(404);
    });

    // FastAPI treats missing Authorization header as a required field validation failure → 422
    test('unauthenticated request returns 422', async () => {
      const resp = await anonClient.get(`/storage/download/${sharedFilePath}`);
      expect(resp.status).toBe(422);
    });
  });

  // ------------------------------------------------------------------
  // Delete
  // ------------------------------------------------------------------

  describe('DELETE /storage/delete/{path} — delete', () => {
    test('deletes an uploaded file and returns 204', async () => {
      const filePath = await uploadFile('delete-test.jpg');

      const delResp = await authedClient.delete(`/storage/delete/${filePath}`);
      expect(delResp.status).toBe(204);

      // Sync tracking array — file already deleted above
      const idx = uploadedPaths.indexOf(filePath);
      if (idx !== -1) uploadedPaths.splice(idx, 1);
    });

    test('delete then download returns 404 (file gone)', async () => {
      const filePath = await uploadFile('delete-then-download.jpg');

      await deleteFile(filePath);

      const getResp = await authedClient.get(`/storage/download/${filePath}`);
      expect(getResp.status).toBe(404);
    });

    test('nonexistent path returns 204 (Supabase Storage silently ignores missing files)', async () => {
      // Supabase Storage returns 204 even when the file doesn't exist (DELETE 0 rows is not an error).
      const resp = await authedClient.delete(`/storage/delete/${currentUserId}/nonexistent-file.jpg`);
      expect(resp.status).toBe(204);
    });

    // FastAPI treats missing Authorization header as a required field validation failure → 422
    test('unauthenticated delete returns 422', async () => {
      const filePath = await uploadFile('unauth-delete-test.jpg');

      try {
        const resp = await anonClient.delete(`/storage/delete/${filePath}`);
        expect(resp.status).toBe(422);
      } finally {
        await deleteFile(filePath);
      }
    });
  });

  // ------------------------------------------------------------------
  // Safety-net: delete any remaining uploaded files
  // ------------------------------------------------------------------

  afterAll(async () => {
    if (!authedClient || uploadedPaths.length === 0) return;
    await Promise.all(
      [...uploadedPaths].map((path) =>
        authedClient
          .delete(`/storage/delete/${path}`)
          .catch((err) =>
            console.warn(`[storage-integration] afterAll cleanup failed for ${path}:`, err)
          )
      )
    );
  });
});
