import { isNextRouterError } from "next/dist/client/components/is-next-router-error";
import { redirect } from "next/navigation";

import { getWorkflowsApiV1WorkflowFetchGet } from "@/client/sdk.gen";
import SignInClient from "@/components/SignInClient";
import { getServerAccessToken,getServerAuthProvider,getServerUser } from "@/lib/auth/server";
import logger from '@/lib/logger';
import { getRedirectUrl } from "@/lib/utils";

export const dynamic = 'force-dynamic';

export default async function Home() {
  logger.debug('[HomePage] Starting Home page render');
  const authProvider = getServerAuthProvider();
  logger.debug('[HomePage] Auth provider:', authProvider);

  // For local/OSS provider, check if user has workflows
  if (authProvider === 'local') {
    logger.debug('[HomePage] Local provider detected, checking for workflows');

    try {
      const accessToken = await getServerAccessToken();
      if (accessToken) {
        const workflowsResponse = await getWorkflowsApiV1WorkflowFetchGet({
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const workflows = workflowsResponse.data ? (Array.isArray(workflowsResponse.data) ? workflowsResponse.data : [workflowsResponse.data]) : [];
        const activeWorkflows = workflows.filter(w => w.status === 'active');

        logger.debug('[HomePage] Found workflows for local provider:', {
          total: workflows.length,
          active: activeWorkflows.length
        });

        if (activeWorkflows.length > 0) {
          logger.debug('[HomePage] Redirecting to /workflow - user has workflows');
          redirect('/workflow');
        } else {
          logger.debug('[HomePage] Redirecting to /overview - no workflows found');
          redirect('/overview');
        }
      }
    } catch (error) {
      // Re-throw navigation errors (redirects, not found, etc.) - they're intentional
      if (isNextRouterError(error)) {
        throw error;
      }

      logger.error('[HomePage] Error checking workflows for local provider:', error);
      // Default to /overview on actual errors
      logger.debug('[HomePage] Defaulting to /overview due to error');
      redirect('/overview');
    }
  }

  logger.debug('[HomePage] Getting server user...');
  const user = await getServerUser();

  logger.debug('[HomePage] Server user result:', {
    hasUser: !!user,
    userId: user?.id,
    authProvider
  });

  if (user) {
    try {
      // For Stack provider, get the token and permissions
      if (authProvider === 'stack' && 'getAuthJson' in user) {
        logger.debug('[HomePage] Getting auth token from Stack user...');
        const token = await user.getAuthJson();
        logger.debug('[HomePage] Got auth token:', { hasToken: !!token?.accessToken });
        const permissions = 'listPermissions' in user && 'selectedTeam' in user
          ? await user.listPermissions(user.selectedTeam!) ?? []
          : [];
        logger.debug('[HomePage] Got permissions:', { count: permissions.length });
        logger.debug('[HomePage] Getting redirect URL...');
        const redirectUrl = await getRedirectUrl(token?.accessToken ?? "", permissions);
        logger.debug('[HomePage] Redirecting to:', redirectUrl);
        redirect(redirectUrl);
      }
    } catch (error) {
      // If it's a Next.js redirect, let it through
      if (error instanceof Error && 'digest' in error &&
          typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
        throw error;
      }
      // For any other errors (including API unavailable), redirect to /overview as fallback
      logger.error('[HomePage] Error in Stack auth flow, redirecting to /overview as fallback:', error);
      logger.debug('[HomePage] User exists but getRedirectUrl() failed, falling back to /overview');
      redirect('/overview');
    }
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        width: "100vw",
        margin: 0,
        padding: 0,
        boxSizing: "border-box",
      }}
    >
      <SignInClient />
    </div>
  );
}
