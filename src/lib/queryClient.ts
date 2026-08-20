// src/lib/queryClient.ts — Singleton do QueryClient do TanStack Query v5
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dados considerados frescos por 30 segundos
      staleTime: 1000 * 30,
      // Cache mantido por 5 minutos após um componente desmontar
      gcTime: 1000 * 60 * 5,
      // Refetch automático ao focar na aba (útil para PWA mobile)
      refetchOnWindowFocus: true,
      // Apenas 1 retry em caso de falha de rede
      retry: 1,
      retryDelay: 500,
    },
    mutations: {
      retry: 0,
    },
  },
})
