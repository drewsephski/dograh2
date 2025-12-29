import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const OSS_TOKEN_COOKIE = 'dograh_oss_token';
const OSS_USER_COOKIE = 'dograh_oss_user';
const FIRST_VISIT_COOKIE = 'dograh_first_visit';

function generateOSSToken(): string {
  return `oss_${Date.now()}_${crypto.randomUUID()}`;
}

function logMiddleware(action: string, data: any) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Middleware] ${action}:`, data);
  }
}

export function middleware(request: NextRequest) {
  const authProvider = process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'stack';
  const { pathname } = request.nextUrl;

  logMiddleware('Request received', {
    pathname,
    authProvider,
    hasToken: !!request.cookies.get(OSS_TOKEN_COOKIE)?.value
  });

  // Only handle OSS mode
  if (authProvider !== 'local') {
    logMiddleware('Skipping - not local auth', { authProvider });
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const token = request.cookies.get(OSS_TOKEN_COOKIE)?.value;
  const isFirstVisit = !request.cookies.get(FIRST_VISIT_COOKIE)?.value;

  // If no token exists, create one
  if (!token) {
    logMiddleware('Creating new token', { isFirstVisit });
    const newToken = generateOSSToken();
    const user = {
      id: newToken,
      name: 'Local User',
      provider: 'local',
      organizationId: `org_${newToken}`,
    };

    // Set cookies in the response (httpOnly for security)
    response.cookies.set(OSS_TOKEN_COOKIE, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    response.cookies.set(OSS_USER_COOKIE, JSON.stringify(user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    logMiddleware('Created new user token', { userId: user.id });
  } else {
    logMiddleware('Using existing token', { token: token.substring(0, 20) + '...' });
  }

  // Set first visit cookie and redirect first-time users to /overview
  if (isFirstVisit && pathname === '/') {
    logMiddleware('First visit detected, setting cookie and redirecting', { pathname });
    response.cookies.set(FIRST_VISIT_COOKIE, 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    });

    // Redirect to /overview for first-time users
    const url = request.nextUrl.clone();
    url.pathname = '/overview';
    logMiddleware('Redirecting first-time user to /overview');
    return NextResponse.redirect(url);
  }

  logMiddleware('Middleware completed', { pathname, hasToken: !!token });
  return response;
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
