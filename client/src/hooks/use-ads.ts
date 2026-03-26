import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type AdInput, type AdResponse } from "@shared/routes";
import { z } from "zod";

// ============================================
// ADS HOOKS
// ============================================

export function useAds(language?: 'ar' | 'en') {
  return useQuery({
    queryKey: [api.ads.list.path, { language }],
    queryFn: async () => {
      const url = buildUrl(api.ads.list.path);
      // Append query params manually since buildUrl handles path params
      const fullUrl = language ? `${url}?language=${language}` : url;
      
      const res = await fetch(fullUrl, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch ads');
      return api.ads.list.responses[200].parse(await res.json());
    },
  });
}

export function useAd(id: number) {
  return useQuery({
    queryKey: [api.ads.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.ads.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch ad');
      return api.ads.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateAd() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: AdInput) => {
      // Validate with client-side schema first
      const validated = api.ads.create.input.parse(data);
      
      const res = await fetch(api.ads.create.path, {
        method: api.ads.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("Unauthorized");
        if (res.status === 400) {
          const error = await res.json();
          throw new Error(error.message || "Validation failed");
        }
        throw new Error('Failed to create ad');
      }
      return api.ads.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.ads.list.path] }),
  });
}

export function useUpdateAd() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<AdInput> }) => {
      const res = await fetch(`/api/ads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "فشل التعديل");
      }
      return res.json();
    },
    onSuccess: (_d, { id }) => {
      queryClient.invalidateQueries({ queryKey: [api.ads.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.ads.get.path, id] });
    },
  });
}

export function useDeleteAd() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.ads.delete.path, { id });
      const res = await fetch(url, { 
        method: api.ads.delete.method, 
        credentials: "include" 
      });
      
      if (!res.ok) throw new Error('Failed to delete ad');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.ads.list.path] }),
  });
}

// ============================================
// AI HOOKS
// ============================================

export function useGenerateAdCopy() {
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.ai.generateAdCopy.input>) => {
      const res = await fetch(api.ai.generateAdCopy.path, {
        method: api.ai.generateAdCopy.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) throw new Error('Failed to generate copy');
      return api.ai.generateAdCopy.responses[200].parse(await res.json());
    },
  });
}

export function useGenerateImage() {
  return useMutation({
    mutationFn: async (prompt: string) => {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, size: "1024x1024" }),
        credentials: "include",
      });

      if (!res.ok) throw new Error('Failed to generate image');
      const data = await res.json();
      return data.url as string;
    },
  });
}
