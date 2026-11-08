'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    try {
      // Redirect to dashboard if authenticated, otherwise to login
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (token) {
        router.push('/dashboard');
      } else {
        router.push('/auth/login');
      }
    } catch (error) {
      console.error('Navigation error:', error);
      router.push('/auth/login');
    }
  }, [router, mounted]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Operix ERP</h1>
        <p className="text-gray-500">Loading...</p>
      </div>
    </div>
  );
}
