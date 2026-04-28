'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function HomePage() {
  const router = useRouter();
  const { token } = useAuthStore();

  useEffect(() => {
    if (token) {
      router.replace('/channels');
    } else {
      router.replace('/login');
    }
  }, [token, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-nexus-bg">
      <div className="animate-pulse text-nexus-muted">Loading...</div>
    </div>
  );
}
