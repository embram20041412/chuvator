import { useState, useEffect, useCallback } from 'react';
import { 
  getTenantProfile, 
  getCourts, 
  getBookings, 
  getTransactions 
} from '../services/supabaseArenaService';

/**
 * Custom hook for fetching tenant profile, courts, bookings, and transactions from Supabase PostgreSQL.
 * Uses promise-based fetch-on-demand with query limits and provides a refetch callback for optimistic sync.
 */
export default function useArenaData(userProfile) {
  const [tenantProfile, setTenantProfile] = useState(userProfile?.tenant || null);
  const [courts, setCourts] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const tenantId = userProfile?.tenant?.id || userProfile?.tenantId || userProfile?.uid;

  const fetchArenaData = useCallback(async () => {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const [tenantRes, courtsRes, bookingsRes, txRes] = await Promise.all([
        getTenantProfile(tenantId),
        getCourts(tenantId),
        getBookings(tenantId, 150),
        getTransactions(tenantId, 150)
      ]);

      if (tenantRes) {
        setTenantProfile(tenantRes);
      } else if (userProfile?.tenant) {
        setTenantProfile(userProfile.tenant);
      }

      setCourts(courtsRes || []);
      setBookings(bookingsRes || []);
      setTransactions(txRes || []);
    } catch (err) {
      console.error('Error fetching arena data from Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, userProfile?.tenant]);

  useEffect(() => {
    fetchArenaData();
  }, [fetchArenaData]);

  // Support custom event dispatched after payment/booking/product changes to trigger instant refetch
  useEffect(() => {
    const handleRefresh = () => {
      fetchArenaData();
    };
    window.addEventListener('simak_refresh_arena_data', handleRefresh);
    return () => window.removeEventListener('simak_refresh_arena_data', handleRefresh);
  }, [fetchArenaData]);

  return {
    tenantProfile: tenantProfile || userProfile?.tenant,
    courts,
    bookings,
    transactions,
    isLoading,
    refetch: fetchArenaData
  };
}
