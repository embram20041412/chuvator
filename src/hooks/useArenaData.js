import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  getTenantProfile, 
  getCourts, 
  getBookings, 
  getTransactions 
} from '../services/supabaseArenaService';

/**
 * Custom hook for fetching tenant profile, courts, bookings, and transactions with TanStack Query caching.
 * Provides instant in-memory rendering (0ms lag when switching tabs) with background SWR revalidation.
 */
export default function useArenaData(userProfile) {
  const queryClient = useQueryClient();
  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['arenaData', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const [tenantRes, courtsRes, bookingsRes, txRes] = await Promise.all([
        getTenantProfile(tenantId),
        getCourts(tenantId),
        getBookings(tenantId, 150),
        getTransactions(tenantId, 150)
      ]);
      return {
        tenantProfile: tenantRes || userProfile?.tenant || null,
        courts: courtsRes || [],
        bookings: bookingsRes || [],
        transactions: txRes || []
      };
    },
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000, // 5 menit: data langsung dari memori saat tab berpindah (instant UI)
    gcTime: 30 * 60 * 1000,
  });

  // Support custom event dispatched after payment/booking/product changes to trigger instant refetch
  useEffect(() => {
    const handleRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ['arenaData', tenantId] });
    };
    window.addEventListener('simak_refresh_arena_data', handleRefresh);
    return () => window.removeEventListener('simak_refresh_arena_data', handleRefresh);
  }, [queryClient, tenantId]);

  return {
    tenantProfile: data?.tenantProfile || userProfile?.tenant || null,
    courts: data?.courts || [],
    bookings: data?.bookings || [],
    transactions: data?.transactions || [],
    isLoading: isLoading && !data, // Hanya true jika data pertama kali dimuat dan belum ada di memori cache
    isFetching,
    refetch
  };
}
