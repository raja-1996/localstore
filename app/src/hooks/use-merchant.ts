import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { merchantService } from '@/services/merchant-service';
import type {
  MerchantDetail,
  ServiceResponse,
  PortfolioImage,
  MerchantCreate,
  MerchantUpdate,
  ServiceCreate,
  ServiceUpdate,
} from '@/types/merchant';

interface MerchantQueryResult {
  merchant: MerchantDetail;
  services: ServiceResponse[];
  portfolio: PortfolioImage[];
}

export function useMerchant(id: string | undefined) {
  return useQuery<MerchantQueryResult, Error>({
    queryKey: ['merchant', id],
    queryFn: async () => {
      const merchantId = id!;
      const [merchantRes, servicesRes, portfolioRes] = await Promise.all([
        merchantService.getMerchant(merchantId),
        merchantService.getMerchantServices(merchantId),
        merchantService.getMerchantPortfolio(merchantId),
      ]);

      return {
        merchant: merchantRes.data,
        services: servicesRes.data,
        portfolio: portfolioRes.data,
      };
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useOwnMerchant() {
  return useQuery<MerchantDetail, Error>({
    queryKey: ['merchant', 'me'],
    queryFn: () => merchantService.getOwnMerchant().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateMerchant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MerchantCreate) =>
      merchantService.createMerchant(data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['merchant', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useUpdateMerchant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MerchantUpdate }) =>
      merchantService.updateMerchant(id, data).then((r) => r.data),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['merchant', id] });
      queryClient.invalidateQueries({ queryKey: ['merchant', 'me'] });
    },
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ merchantId, data }: { merchantId: string; data: ServiceCreate }) =>
      merchantService.createService(merchantId, data).then((r) => r.data),
    onSuccess: (_result, { merchantId }) => {
      queryClient.invalidateQueries({ queryKey: ['merchant', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['merchant', 'me'] });
    },
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      merchantId,
      serviceId,
      data,
    }: {
      merchantId: string;
      serviceId: string;
      data: ServiceUpdate;
    }) =>
      merchantService.updateService(merchantId, serviceId, data).then((r) => r.data),
    onSuccess: (_result, { merchantId }) => {
      queryClient.invalidateQueries({ queryKey: ['merchant', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['merchant', 'me'] });
    },
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ merchantId, serviceId }: { merchantId: string; serviceId: string }) =>
      merchantService.deleteService(merchantId, serviceId),
    onSuccess: (_result, { merchantId }) => {
      queryClient.invalidateQueries({ queryKey: ['merchant', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['merchant', 'me'] });
    },
  });
}

export function useAddPortfolioImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ merchantId, data }: { merchantId: string; data: { image_url: string; caption?: string } }) =>
      merchantService.addPortfolioImage(merchantId, data).then((r) => r.data),
    onSuccess: (_result, { merchantId }) => {
      queryClient.invalidateQueries({ queryKey: ['merchant', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['merchant', 'me'] });
    },
  });
}

export function useDeletePortfolioImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ merchantId, imageId }: { merchantId: string; imageId: string }) =>
      merchantService.deletePortfolioImage(merchantId, imageId),
    onSuccess: (_result, { merchantId }) => {
      queryClient.invalidateQueries({ queryKey: ['merchant', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['merchant', 'me'] });
    },
  });
}

export function useReorderPortfolio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ merchantId, order }: { merchantId: string; order: string[] }) =>
      merchantService.reorderPortfolio(merchantId, order),
    onSuccess: (_result, { merchantId }) => {
      queryClient.invalidateQueries({ queryKey: ['merchant', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['merchant', 'me'] });
    },
  });
}
