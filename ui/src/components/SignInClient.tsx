"use client";

import { Loader2, Home } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import Footer from './Footer';
import RedirectLoader from './RedirectLoader';

// Only load Stack's SignIn component when Stack provider is active
const SignIn = dynamic(
  () => import('@stackframe/stack').then(mod => ({ default: mod.SignIn })),
  { ssr: false, loading: () => <Loader2 className="w-5 h-5 animate-spin text-gray-600" /> }
);

export default function SignInClient() {
  const authProvider = process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'stack';
  const { user, provider } = useAuth();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  // Handle authenticated users
  useEffect(() => {
    if (user) {
      setIsRedirecting(true);
      // For local auth, redirect immediately
      if (provider === 'local') {
        router.push('/overview');
      } else {
        // For Stack auth, show redirect message for 2 seconds then redirect
        const timer = setTimeout(() => {
          router.push('/overview');
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [user, provider, router]);
  
  // If user is authenticated and redirecting
  if (user) {
    return <RedirectLoader destination="/overview" destinationName="your dashboard" />;
  }

  if (authProvider !== 'stack') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold mb-4">Local Authentication</h1>
          <p className="text-gray-600">Local authentication is enabled. Redirecting to dashboard...</p>
          <Button 
            onClick={() => router.push('/overview')}
            variant="outline"
          >
            <Home className="w-4 h-4 mr-2" />
            Go to Dashboard
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <SignIn />
      <Footer />
    </>
  );
}
