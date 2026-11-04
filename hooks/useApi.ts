'use client';

import { useState, useCallback } from 'react';
import axios from 'axios';

interface UseApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
}

export function useApi<T = any>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(
    async (url: string, options: UseApiOptions = {}) => {
      try {
        setLoading(true);
        setError(null);

        const response = await axios({
          url,
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        setData(response.data);
        return response.data;
      } catch (err: any) {
        const message = err.response?.data?.error || err.message || 'An error occurred';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { data, loading, error, request };
}
