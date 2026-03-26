import api from '../lib/api';

const storageService = {
  upload: (formData: FormData) =>
    api.post<{ path: string; url: string }>('/storage/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getUrl: (path: string) =>
    api.get<{ url: string }>(`/storage/download/${path}`),

  delete: (path: string) =>
    api.delete(`/storage/delete/${path}`),
};

export default storageService;
