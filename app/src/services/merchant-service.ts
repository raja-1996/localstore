import api from '@/lib/api';
import type {
  MerchantDetail,
  ServiceResponse,
  PortfolioImage,
  MerchantCreate,
  MerchantUpdate,
  ServiceCreate,
  ServiceUpdate,
} from '@/types/merchant';

export const merchantService = {
  getMerchant: (id: string) =>
    api.get<MerchantDetail>(`/merchants/${id}`),

  getMerchantServices: (merchantId: string) =>
    api.get<ServiceResponse[]>(`/merchants/${merchantId}/services`),

  getMerchantPortfolio: (merchantId: string) =>
    api.get<PortfolioImage[]>(`/merchants/${merchantId}/portfolio`),

  getOwnMerchant: () =>
    api.get<MerchantDetail>('/merchants/me'),

  createMerchant: (data: MerchantCreate) =>
    api.post<MerchantDetail>('/merchants', data),

  updateMerchant: (id: string, data: MerchantUpdate) =>
    api.patch<MerchantDetail>(`/merchants/${id}`, data),

  createService: (merchantId: string, data: ServiceCreate) =>
    api.post<ServiceResponse>(`/merchants/${merchantId}/services`, data),

  updateService: (merchantId: string, serviceId: string, data: ServiceUpdate) =>
    api.patch<ServiceResponse>(`/merchants/${merchantId}/services/${serviceId}`, data),

  deleteService: (merchantId: string, serviceId: string) =>
    api.delete(`/merchants/${merchantId}/services/${serviceId}`),

  addPortfolioImage: (merchantId: string, data: { image_url: string; caption?: string }) =>
    api.post<PortfolioImage>(`/merchants/${merchantId}/portfolio`, data),

  deletePortfolioImage: (merchantId: string, imageId: string) =>
    api.delete(`/merchants/${merchantId}/portfolio/${imageId}`),

  reorderPortfolio: (merchantId: string, order: string[]) =>
    api.patch(`/merchants/${merchantId}/portfolio/reorder`, { order }),
};
