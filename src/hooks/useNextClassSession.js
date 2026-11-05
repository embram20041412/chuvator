import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { formatIndonesianDate } from '../utils/scheduleGenerator';

/**
 * Custom hook to fetch the nearest upcoming class session (date >= today, ascending).
 * Suitable for Attendance Module, Class Cards, and Parent Portal.
 * 
 * @param {string} classId - UUID of the class
 * @param {string} [tenantId] - Optional tenant ID filter
 * @returns {Object} { nextSession, formattedSession, formattedDate, timeRange, courtName, loading, error, refetch }
 */
export function useNextClassSession(classId, tenantId = null) {
  const [nextSession, setNextSession] = useState(null);
  const [loading, setLoading] = useState(Boolean(classId));
  const [error, setError] = useState(null);

  const fetchNextSession = useCallback(async () => {
    if (!classId) {
      setNextSession(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const today = new Date().toISOString().split('T')[0];

      let query = supabase
        .from('bookings')
        .select('id, class_id, court_id, court_name, date, start_time, end_time, booking_type, status, customer_name')
        .eq('class_id', classId)
        .gte('date', today)
        .not('status', 'in', '("Dibatalkan","Cancelled","VOID")')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(1);

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error: qErr } = await query;

      if (qErr) {
        throw qErr;
      }

      if (Array.isArray(data) && data.length > 0) {
        setNextSession(data[0]);
      } else {
        setNextSession(null);
      }
    } catch (err) {
      console.warn('[useNextClassSession] Error fetching next session:', err.message);
      setError(err);
      setNextSession(null);
    } finally {
      setLoading(false);
    }
  }, [classId, tenantId]);

  useEffect(() => {
    fetchNextSession();

    // Auto refresh when arena data changes
    const handleRefresh = () => {
      fetchNextSession();
    };

    window.addEventListener('simak_refresh_arena_data', handleRefresh);
    return () => {
      window.removeEventListener('simak_refresh_arena_data', handleRefresh);
    };
  }, [fetchNextSession]);

  // Formatted helpers
  const formattedDate = nextSession ? formatIndonesianDate(nextSession.date) : '';
  const timeRange = nextSession ? `${nextSession.start_time} - ${nextSession.end_time}` : '';
  const courtName = nextSession?.court_name || '';

  const formattedSession = nextSession
    ? `Sesi Terdekat: ${formattedDate} (${timeRange}${courtName ? ` • ${courtName}` : ''})`
    : 'Belum ada sesi terjadwal';

  return {
    nextSession,
    formattedSession,
    formattedDate,
    timeRange,
    courtName,
    loading,
    error,
    refetch: fetchNextSession
  };
}

export default useNextClassSession;
