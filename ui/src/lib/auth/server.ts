import "server-only";

import type { CurrentUser, StackServerApp } from '@stackframe/stack';
import { cookies } from 'next/headers';

import logger from '@/lib/logger';

import type { LocalUser } from './types';

// Server-side auth utilities for SSR pages
// This file should only be imported in server components

let stackServerApp: StackServerApp<boolean, string> | null = null;
const OSS_TOKEN_COOKIE = 'dograh_oss_token';
const OSS_USER_COOKIE = 'dograh_oss_user';

// Lazy load and cache the stack server app
async function getStackServerApp(): Promise<StackServerApp<boolean, string> | null> {
  if (!stackServerApp) {
    // Only import if using Stack provider
    const authProvider = process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'stack';
    if (authProvider === 'stack') {
      const stackModule = await import('@stackframe/stack');
      const { StackServerApp } = stackModule;
      stackServerApp = new StackServerApp({
        tokenStore: "nextjs-cookie",
        urls: {
          afterSignIn: "/after-sign-in"
        }
      });
    }
  }
  return stackServerApp;
}

/**
 * Get the current user on the server side (for SSR)
 * Returns CurrentUser for stack, LocalUser for OSS, or null if not authenticated
 */
export async function getServerUser(): Promise<CurrentUser | LocalUser | null> {
  const authProvider = process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'stack';

  logger.debug('[getServerUser] Getting user for provider:', authProvider);

  if (authProvider === 'stack') {
    const app = await getStackServerApp();
    if (app) {
      try {
        const user = await app.getUser();
        logger.debug('[getServerUser] Stack user result:', { hasUser: !!user, userId: user?.id });
        return user;
      } catch (error) {
        logger.error('[getServerUser] Error getting user from Stack:', error);
        return null;
      }
    }
  } else if (authProvider === 'local') {
    // For OSS mode, get user from cookies (created by middleware)
    const user = await getOSSUser();
    logger.debug('[getServerUser] OSS user result:', { hasUser: !!user, userId: user?.id });
    return user;
  }

  logger.debug('[getServerUser] No user found for unknown provider');
  return null;
}

/**
 * Check if user is authenticated on the server side
 * For local provider, always returns true in development
 */
export async function isServerAuthenticated(): Promise<boolean> {
  const authProvider = process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'stack';

  if (authProvider === 'stack') {
    const user = await getServerUser();
    return !!user;
  }

  // For local provider, consider authenticated in development
  if (authProvider === 'local') {
    return process.env.NODE_ENV === 'development';
  }

  return false;
}

/**
 * Get provider name for server-side rendering
 */
export function getServerAuthProvider(): string {
  return process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'stack';
}

/**
 * Get OSS token from cookies (read-only)
 * Token creation happens in middleware
 */
export async function getOSSToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(OSS_TOKEN_COOKIE)?.value || null;
}

/**
 * Get OSS user from cookies
 */
export async function getOSSUser(): Promise<LocalUser | null> {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get(OSS_USER_COOKIE)?.value;

  if (userCookie) {
    try {
      return JSON.parse(userCookie);
    } catch (error) {
      logger.error('Error listing permissions:', error);
      return null;
    }
  }

  // If no user cookie, but we have a token, create user
  const token = cookieStore.get(OSS_TOKEN_COOKIE)?.value;
  if (token) {
    const user: LocalUser = {
      id: token,
      name: 'Local User',
      provider: 'local',
      organizationId: `org_${token}`,
    };
    return user;
  }

  return null;
}

/**
 * Get access token for API calls
 */
export async function getServerAccessToken(): Promise<string | null> {
  const authProvider = getServerAuthProvider();

  logger.debug('[getServerAccessToken] Getting token for provider:', authProvider);

  if (authProvider === 'stack') {
    try {
      const user = await getServerUser();
      if (user && 'getAuthJson' in user) {
        const auth = await user.getAuthJson();
        const token = auth?.accessToken ?? null;
        logger.debug('[getServerAccessToken] Stack token result:', { hasToken: !!token });
        return token;
      }
      logger.debug('[getServerAccessToken] No Stack user or no getAuthJson method');
    } catch (error) {
      logger.error('[getServerAccessToken] Error getting Stack token:', error);
      return null;
    }
  } else if (authProvider === 'local') {
    // Get token from cookies (created by middleware)
    try {
      const oss_token = await getOSSToken();
      logger.debug('[getServerAccessToken] OSS token result:', { hasToken: !!oss_token });
      return oss_token;
    } catch (error) {
      logger.error('[getServerAccessToken] Error getting OSS token:', error);
      return null;
    }
  }

  logger.debug('[getServerAccessToken] No token found for unknown provider');
  return null;
}

/**
 * Get server user with fallback - never throws errors
 */
export async function getServerUserWithFallback(): Promise<CurrentUser | LocalUser | null> {
  try {
    return await getServerUser();
  } catch (error) {
    logger.error('[getServerUserWithFallback] Error getting user, returning null:', error);
    return null;
  }
}

/**
 * Check if user is first-time user based on cookies
 */
export async function isFirstTimeUser(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const firstVisitCookie = cookieStore.get('dograh_first_visit')?.value;
    return !firstVisitCookie;
  } catch (error) {
    logger.error('[isFirstTimeUser] Error checking first visit cookie:', error);
    return false; // Default to not first-time on error
  }
}
