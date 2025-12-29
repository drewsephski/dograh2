"use client";

import { BookOpen, CheckCircle, Clock, MessageSquare, Plus, Settings, Star, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { getWorkflowsApiV1WorkflowFetchGet } from '@/client/sdk.gen';
import WelcomeModal from '@/components/onboarding/WelcomeModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useOnboarding } from '@/context/OnboardingContext';
import { useAuth } from '@/lib/auth';

export default function OverviewPage() {
    const { user, provider, getAccessToken } = useAuth();
    const { shouldShowWelcomeModal } = useOnboarding();
    const [isModalOpen, setIsModalOpen] = useState(true);
    const isOSSMode = provider !== 'stack';
    const [workflows, setWorkflows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Mock onboarding progress - in real app this would come from API/context
    const onboardingSteps = [
        { id: 'create_workflow', label: 'Create your first workflow', completed: workflows.length > 0 },
        { id: 'configure_models', label: 'Configure AI models', completed: false },
        { id: 'test_agent', label: 'Test your voice agent', completed: false },
        { id: 'deploy', label: 'Deploy to phone', completed: false },
        { id: 'monitor', label: 'Set up monitoring', completed: false },
    ];

    const completedSteps = onboardingSteps.filter(step => step.completed).length;
    const onboardingProgress = (completedSteps / onboardingSteps.length) * 100;

    useEffect(() => {
        const fetchWorkflows = async () => {
            try {
                setLoading(true);
                setError(null);

                // Get client-safe access token from auth context
                const accessToken = await getAccessToken();

                if (!accessToken) {
                    setError('Authentication required');
                    setLoading(false);
                    return;
                }

                // Fetch real workflows using the API client
                const workflowsResponse = await getWorkflowsApiV1WorkflowFetchGet({
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });

                const fetchedWorkflows = workflowsResponse.data ?
                    (Array.isArray(workflowsResponse.data) ? workflowsResponse.data : [workflowsResponse.data]) :
                    [];

                setWorkflows(fetchedWorkflows);
            } catch (err) {
                console.error('Failed to fetch workflows:', err);
                setError('Failed to load workflows');
            } finally {
                setLoading(false);
            }
        };

        fetchWorkflows();
    }, [getAccessToken]);

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
                {/* Loading State */}
                {loading && (
                    <Card className="mb-8">
                        <CardContent className="flex items-center justify-center py-8">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                <p className="text-muted-foreground">Don't worry, your work is safe.</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Error State */}
                {error && !loading && (
                    <Card className="mb-8 border-red-200">
                        <CardContent className="py-6">
                            <div className="text-center">
                                <p className="text-red-600 mb-2">{error}</p>
                                <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                                    Try Again
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Getting Started Section for New Users */}
                {!loading && !error && workflows.length === 0 && (
                    <Card className="mb-8 border-blue-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-blue-600" />
                                Getting Started
                            </CardTitle>
                            <CardDescription>
                                Welcome! Let's get you set up with your first voice AI agent
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Setup Progress</span>
                                    <span className="text-sm text-muted-foreground">{completedSteps}/{onboardingSteps.length} steps</span>
                                </div>
                                <Progress value={onboardingProgress} className="h-2" />
                                <div className="space-y-2">
                                    {onboardingSteps.map((step) => (
                                        <div key={step.id} className="flex items-center gap-2 text-sm">
                                            {step.completed ? (
                                                <CheckCircle className="h-4 w-4 text-green-600" />
                                            ) : (
                                                <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                                            )}
                                            <span className={step.completed ? 'text-green-600' : 'text-gray-400'}>
                                                {step.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Recent Activity */}
                {!loading && !error && workflows.length > 0 && (
                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                Recent Activity
                            </CardTitle>
                            <CardDescription>
                                Your recently accessed workflows and campaigns
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {workflows.slice(0, 3).map((workflow) => (
                                    <div key={workflow.id} className="flex items-center justify-between p-3 rounded-lg border">
                                        <div>
                                            <p className="font-medium">{workflow.name}</p>
                                            <p className="text-sm text-muted-foreground">Last modified: {workflow.updatedAt}</p>
                                        </div>
                                        <Button asChild variant="outline" size="sm">
                                            <Link href={`/workflow/${workflow.id}`}>
                                                Open
                                            </Link>
                                        </Button>
                                    </div>
                                ))}
                                {workflows.length === 0 && (
                                    <p className="text-muted-foreground text-center py-4">
                                        No recent activity. Create your first workflow to get started!
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle className="text-3xl">
                            {isOSSMode ? (
                                "Welcome to Voxora"
                            ) : (
                                `Welcome${user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}!`
                            )}
                        </CardTitle>
                        <CardDescription className="text-lg mt-2">
                            {isOSSMode ? (
                                <>
                                    Open source alternative to Vapi. Help us support the project by giving us a star on GitHub.
                                </>
                            ) : (
                                "Get started with building voice AI workflows"
                            )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isOSSMode && (
                            <Button asChild className="mb-6">
                                <a
                                    href="https://github.com/drewsephski/voxora"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center"
                                >
                                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                    Star us on GitHub
                                </a>
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="hover:shadow-md transition-shadow">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Plus className="h-5 w-5" />
                                Create Workflow
                            </CardTitle>
                            <CardDescription>
                                Build a new voice AI agent with our visual editor
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild className="w-full">
                                <Link href="/workflow/create">
                                    Create New Agent
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-md transition-shadow">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="h-5 w-5" />
                                Configure Models
                            </CardTitle>
                            <CardDescription>
                                Set up LLM, TTS, and STT providers for your agents
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild variant="outline" className="w-full">
                                <Link href="/model-configurations">
                                    Configure Models
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-md transition-shadow">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BookOpen className="h-5 w-5" />
                                Learn More
                            </CardTitle>
                            <CardDescription>
                                Browse documentation and tutorials
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild variant="outline" className="w-full">
                                <a
                                    href="https://docs.voxora.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    View Docs
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Community & Support */}
                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" />
                            Community & Support
                        </CardTitle>
                        <CardDescription>
                            Get help and connect with the Voxora community
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Button asChild variant="outline" className="w-full">
                                <a
                                    href="https://docs.voxora.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Documentation
                                </a>
                            </Button>
                            <Button asChild variant="outline" className="w-full">
                                <a
                                    href="https://github.com/drewsephski/voxora/issues"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Report Issue
                                </a>
                            </Button>
                            <Button asChild variant="outline" className="w-full">
                                <a
                                    href="https://github.com/drewsephski/voxora/discussions"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Community
                                </a>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Welcome Modal for First-Time Users */}
            <WelcomeModal
                isOpen={isModalOpen && shouldShowWelcomeModal()}
                onClose={() => setIsModalOpen(false)}
            />
        </div>
    );
}
