'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useModelStore } from '@/store/useModelStore';

/** Scenario comparison moved to the deal dashboard; send old links there. */
export default function CompareRedirect() {
  const router = useRouter();
  const activeProjectId = useModelStore((s) => s.activeProjectId);
  useEffect(() => {
    router.replace(activeProjectId ? `/deals/${activeProjectId}` : '/');
  }, [router, activeProjectId]);
  return null;
}
