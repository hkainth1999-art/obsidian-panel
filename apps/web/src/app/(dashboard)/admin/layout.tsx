'use client';
 
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/auth-context';
import { ShieldAlert } from 'lucide-react';
 
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
 
  useEffect(() => {
    if (!isLoading && user && !user.isAdmin) {
      router.replace('/servers');
    }
  }, [user, isLoading, router]);
 
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
 
  if (!user || !user.isAdmin) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center mt-12">
        <div className="w-12 h-12 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center text-danger mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">Access Restricted</h2>
        <p className="text-xs text-text-muted mt-2">
          Administrator privileges are required to view and manage this area. Redirecting you to your servers...
        </p>
      </div>
    );
  }
 
  return <>{children}</>;
}
