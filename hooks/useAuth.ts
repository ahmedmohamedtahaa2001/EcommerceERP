'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase';
import type { User } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      try {
        // Initialize Supabase client
        const supabase = getBrowserClient();

        // Check for mock/demo token first
        if (typeof window !== 'undefined') {
          const mockToken = localStorage.getItem('auth_token');
          const userEmail = localStorage.getItem('user_email');
          const userId = localStorage.getItem('user_id');

          if (mockToken && userEmail) {
            // Use mock user data
            const mockUser: User = {
              id: userId || 'demo-user',
              email: userEmail,
              first_name: 'Demo',
              last_name: 'User',
              role: 'admin',
              company_id: 'demo-company',
              active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            setUser(mockUser);
            setLoading(false);
            return;
          }
        }

        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          // Fetch user profile from users table
          const { data: userProfile } = await supabase
            .from('users')
            .select('*')
            .eq('email', authUser.email)
            .single();

          if (userProfile) {
            setUser(userProfile as User);
          } else {
            // Create a user object from auth data
            setUser({
              id: authUser.id,
              email: authUser.email || '',
              first_name: authUser.user_metadata?.first_name || 'User',
              last_name: authUser.user_metadata?.last_name || '',
              role: 'viewer',
              company_id: '',
              active: true,
              created_at: authUser.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };

    getUser();

    // Subscribe to auth changes
    const supabase = getBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: userProfile } = await supabase
          .from('users')
          .select('*')
          .eq('email', session.user.email)
          .single();

        if (userProfile) {
          setUser(userProfile as User);
        }
      } else {
        setUser(null);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_id');
        router.push('/auth/login');
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [router]);

  return { user, loading };
}

export function useRequireAuth() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  return { user, loading };
}
