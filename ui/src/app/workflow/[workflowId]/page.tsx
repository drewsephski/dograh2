'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import RenderWorkflow from '@/app/workflow/[workflowId]/RenderWorkflow';
import { getWorkflowApiV1WorkflowFetchWorkflowIdGet } from '@/client/sdk.gen';
import type { WorkflowResponse } from '@/client/types.gen';
import { FlowEdge, FlowNode } from '@/components/flow/types';
import { Button } from '@/components/ui/button';
import SpinLoader from '@/components/SpinLoader';
import { useAuth } from '@/lib/auth';
import logger from '@/lib/logger';
import { DEFAULT_WORKFLOW_CONFIGURATIONS, WorkflowConfigurations } from '@/types/workflow-configurations';

import WorkflowLayout from '../WorkflowLayout';

export default function WorkflowDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [workflow, setWorkflow] = useState<WorkflowResponse | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user, getAccessToken, redirectToLogin, loading: authLoading } = useAuth();

    // Redirect if not authenticated
    useEffect(() => {
        if (!authLoading && !user) {
            redirectToLogin();
        }
    }, [authLoading, user, redirectToLogin]);

    useEffect(() => {
        const fetchWorkflow = async () => {
            if (!user) return;
            try {
                const accessToken = await getAccessToken();
                const response = await getWorkflowApiV1WorkflowFetchWorkflowIdGet({
                    path: {
                        workflow_id: Number(params.workflowId)
                    },
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                });
                const workflow = response.data;
                setWorkflow(workflow);
            } catch (err) {
                setError('Failed to fetch workflow');
                logger.error(`Error fetching workflow: ${err}`);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchWorkflow();
        }
    }, [params.workflowId, user, getAccessToken]);

    // Memoize user and getAccessToken to prevent unnecessary re-renders
    const stableUser = useMemo(() => user, [user]);
    const stableGetAccessToken = useMemo(() => getAccessToken, [getAccessToken]);

    // Validate workflow structure before rendering
    const validateWorkflowStructure = (workflow: WorkflowResponse) => {
        if (!workflow.workflow_definition) {
            return false;
        }

        const definition = workflow.workflow_definition;
        if (!definition.nodes || !Array.isArray(definition.nodes)) {
            return false;
        }

        if (definition.nodes.length === 0) {
            return false;
        }

        // Check for at least one start node
        const hasStartNode = definition.nodes.some((node: any) => 
            node.data?.is_start || node.type === 'startCall' || node.type === 'trigger'
        );

        return hasStartNode;
    };

    if (loading) {
        return (
            <WorkflowLayout>
                <SpinLoader />
            </WorkflowLayout>
        );
    }
    else if (error || !workflow) {
        return (
            <WorkflowLayout showFeaturesNav={false}>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-lg text-destructive">{error || 'Workflow not found'}</div>
                </div>
            </WorkflowLayout>
        );
    }
    else if (!validateWorkflowStructure(workflow)) {
        return (
            <WorkflowLayout showFeaturesNav={false}>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center space-y-4 max-w-md">
                        <div className="text-lg text-destructive">
                            This workflow has an invalid structure. Please recreate it.
                        </div>
                        <Button 
                            onClick={() => router.push('/workflow/create')}
                            className="w-full"
                        >
                            Recreate Workflow
                        </Button>
                    </div>
                </div>
            </WorkflowLayout>
        );
    }
    else {
        return stableUser ? (
            <RenderWorkflow
                initialWorkflowName={workflow.name}
                workflowId={workflow.id}
                initialFlow={{
                    nodes: workflow.workflow_definition.nodes as FlowNode[],
                    edges: workflow.workflow_definition.edges as FlowEdge[],
                    viewport: { x: 0, y: 0, zoom: 0 }
                }}
                initialTemplateContextVariables={workflow.template_context_variables as Record<string, string> || {}}
                initialWorkflowConfigurations={(workflow.workflow_configurations as WorkflowConfigurations) || DEFAULT_WORKFLOW_CONFIGURATIONS}
                user={stableUser}
                getAccessToken={stableGetAccessToken}
            />
        ) : null;
    }
}
