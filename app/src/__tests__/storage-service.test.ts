import storageService from '../services/storage-service';
import api from '../lib/api';

jest.mock('../lib/api', () => ({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
}));

const mockApi = api as jest.Mocked<typeof api>;

const mockUploadResponse = Object.freeze({
  path: 'uploads/image-123.jpg',
  url: 'https://cdn.example.com/uploads/image-123.jpg',
});

const mockUrlResponse = Object.freeze({
  url: 'https://cdn.example.com/uploads/image-123.jpg',
});

describe('storageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('upload', () => {
    it('calls POST /storage/upload', async () => {
      const formData = new FormData();
      mockApi.post.mockResolvedValueOnce({ data: mockUploadResponse });
      await storageService.upload(formData);
      expect(mockApi.post).toHaveBeenCalledWith(
        '/storage/upload',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
    });

    it('returns { path, url } on success', async () => {
      const formData = new FormData();
      mockApi.post.mockResolvedValueOnce({ data: mockUploadResponse });
      const result = await storageService.upload(formData);
      expect(result.data).toEqual(mockUploadResponse);
    });

    it('rejects when API returns an error', async () => {
      const formData = new FormData();
      const error = { response: { status: 500 } };
      mockApi.post.mockRejectedValueOnce(error);
      await expect(storageService.upload(formData)).rejects.toMatchObject({
        response: { status: 500 },
      });
    });
  });

  describe('getUrl', () => {
    it('calls GET /storage/download/{path} with correct path', async () => {
      mockApi.get.mockResolvedValueOnce({ data: mockUrlResponse });
      await storageService.getUrl('uploads/image-123.jpg');
      expect(mockApi.get).toHaveBeenCalledWith('/storage/download/uploads/image-123.jpg');
    });

    it('returns { url } on success', async () => {
      mockApi.get.mockResolvedValueOnce({ data: mockUrlResponse });
      const result = await storageService.getUrl('uploads/image-123.jpg');
      expect(result.data).toEqual(mockUrlResponse);
    });

    it('rejects on 404 when file is not found', async () => {
      const error = { response: { status: 404, data: { detail: 'File not found' } } };
      mockApi.get.mockRejectedValueOnce(error);
      await expect(storageService.getUrl('uploads/missing.jpg')).rejects.toMatchObject({
        response: { status: 404 },
      });
    });
  });

  describe('delete', () => {
    it('calls DELETE /storage/delete/{path} with correct path', async () => {
      mockApi.delete.mockResolvedValueOnce(undefined);
      await storageService.delete('uploads/image-123.jpg');
      expect(mockApi.delete).toHaveBeenCalledWith('/storage/delete/uploads/image-123.jpg');
    });

    it('resolves on successful deletion', async () => {
      mockApi.delete.mockResolvedValueOnce(undefined);
      const result = await storageService.delete('uploads/image-123.jpg');
      expect(result).toBeUndefined();
    });

    it('rejects when API returns an error', async () => {
      const error = { response: { status: 403 } };
      mockApi.delete.mockRejectedValueOnce(error);
      await expect(storageService.delete('uploads/image-123.jpg')).rejects.toMatchObject({
        response: { status: 403 },
      });
    });

    it('rejects on 404 when file does not exist', async () => {
      const error = { response: { status: 404, data: { detail: 'File not found' } } };
      mockApi.delete.mockRejectedValueOnce(error);
      await expect(storageService.delete('uploads/missing.jpg')).rejects.toMatchObject({
        response: { status: 404 },
      });
    });
  });
});
