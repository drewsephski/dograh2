'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createWorkflowFromTemplateApiV1WorkflowCreateTemplatePost, createWorkflowRunApiV1WorkflowWorkflowIdRunsPost } from '@/client/sdk.gen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { WORKFLOW_RUN_MODES } from '@/constants/workflowRunModes';
import { useAuth } from '@/lib/auth';
import logger from '@/lib/logger';
import { getRandomId } from '@/lib/utils';

export default function CreateWorkflowPage() {
    const router = useRouter();
    const { user, getAccessToken } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [workflowId, setWorkflowId] = useState<string | null>(null);

    const [callType, setCallType] = useState<'INBOUND' | 'OUTBOUND'>('INBOUND');
    const [useCase, setUseCase] = useState('');
    const [activityDescription, setActivityDescription] = useState('');

    // Form validation states
    const [useCaseError, setUseCaseError] = useState<string | null>(null);
    const [activityDescriptionError, setActivityDescriptionError] = useState<string | null>(null);

    // Validate individual fields
    const validateUseCase = (value: string) => {
        if (!value.trim()) {
            return 'Use case is required';
        }
        if (value.trim().length < 3) {
            return 'Use case must be at least 3 characters long';
        }
        return null;
    };

    const validateActivityDescription = (value: string) => {
        if (!value.trim()) {
            return 'Activity description is required';
        }
        if (value.trim().length < 10) {
            return 'Activity description must be at least 10 characters long';
        }
        return null;
    };

    // Check if form is valid
    const isFormValid = () => {
        return !validateUseCase(useCase) && !validateActivityDescription(activityDescription);
    };

    // Loading progress simulation
    const simulateLoadingProgress = () => {
        const startTime = Date.now();
        setLoadingStartTime(startTime);
        
        const progressStages = [
            { progress: 25, message: "Analyzing your requirements...", delay: 2000 },
            { progress: 50, message: "Generating workflow structure...", delay: 3000 },
            { progress: 75, message: "Creating agent nodes...", delay: 3000 },
            { progress: 90, message: "Finalizing your workflow...", delay: 2000 },
        ];

        progressStages.forEach((stage, index) => {
            setTimeout(() => {
                if (isLoading) { // Only update if still loading
                    setLoadingProgress(stage.progress);
                    setLoadingMessage(stage.message);
                }
            }, stage.delay);
        });

        // Check for timeout after 30 seconds
        setTimeout(() => {
            if (isLoading) {
                setError("This is taking longer than usual. The AI service might be experiencing high load.");
            }
        }, 15000);

        // Force timeout after 30 seconds
        setTimeout(() => {
            if (isLoading) {
                setIsLoading(false);
                setError("Workflow generation timed out. Please try again.");
            }
        }, 30000);
    };

    // Parse error responses to show specific messages
    const parseError = (err: any) => {
        if (err?.response?.data?.detail) {
            return err.response.data.detail;
        }
        
        if (err?.response?.status) {
            switch (err.response.status) {
                case 400:
                    return "Invalid request. Please check your input and try again.";
                case 401:
                    return "You are not authorized. Please log in again.";
                case 403:
                    return "You don't have permission to create workflows.";
                case 429:
                    return "Too many requests. Please wait a moment and try again.";
                case 500:
                    return "Server error. Please try again later.";
                case 503:
                    return "AI service is temporarily unavailable. Please try again.";
                case 504:
                    return "AI workflow generation timed out. Please try again.";
                default:
                    return `Server error (${err.response.status}). Please try again.`;
            }
        }
        
        if (err?.code === 'NETWORK_ERROR' || err?.message?.includes('fetch')) {
            return "Unable to connect to server. Please check your connection.";
        }
        
        if (err?.name === 'AbortError') {
            return "Request was cancelled. Please try again.";
        }
        
        return "An unexpected error occurred. Please try again.";
    };

    const handleCreateWorkflow = async () => {
        // Clear previous errors
        setError(null);
        setUseCaseError(null);
        setActivityDescriptionError(null);

        // Validate form
        const useCaseErr = validateUseCase(useCase);
        const activityDescErr = validateActivityDescription(activityDescription);
        
        if (useCaseErr) {
            setUseCaseError(useCaseErr);
        }
        if (activityDescErr) {
            setActivityDescriptionError(activityDescErr);
        }

        if (useCaseErr || activityDescErr) {
            setError('Please fix the validation errors below');
            return;
        }

        if (!user) {
            setError('You must be logged in to create a workflow');
            return;
        }

        setIsLoading(true);
        setError(null);
        setLoadingProgress(0);
        setLoadingMessage("Initializing...");
        simulateLoadingProgress();

        try {
            const accessToken = await getAccessToken();

            // Call the API to create workflow from template
            const response = await createWorkflowFromTemplateApiV1WorkflowCreateTemplatePost({
                body: {
                    call_type: callType,
                    use_case: useCase,
                    activity_description: activityDescription,
                },
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (response.data?.id) {
                setWorkflowId(String(response.data.id));
                setShowSuccessModal(true);
            }
        } catch (err) {
            const errorMessage = parseError(err);
            setError(errorMessage);
            logger.error(`Error creating workflow: ${err}`, { error: err, errorMessage });
        } finally {
            setIsLoading(false);
            setLoadingProgress(0);
            setLoadingMessage('');
            setLoadingStartTime(null);
        }
    };

    const handleRetry = () => {
        setError(null);
        handleCreateWorkflow();
    };

    const handleViewWorkflow = () => {
        if (workflowId) {
            router.push(`/workflow/${workflowId}`);
        }
    };

    const handleCreateAnother = () => {
        // Reset form
        setCallType('INBOUND');
        setUseCase('');
        setActivityDescription('');
        setUseCaseError(null);
        setActivityDescriptionError(null);
        setError(null);
        setShowSuccessModal(false);
        setWorkflowId(null);
    };

    const handleModalContinue = async () => {
        if (!workflowId || !user) return;

        try {
            const accessToken = await getAccessToken();
            const workflowRunName = `WR-${getRandomId()}`;

            // Create a workflow run
            const response = await createWorkflowRunApiV1WorkflowWorkflowIdRunsPost({
                path: {
                    workflow_id: Number(workflowId),
                },
                body: {
                    mode: WORKFLOW_RUN_MODES.SMALL_WEBRTC, // Same mode as "Web Call" button
                    name: workflowRunName
                },
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            // Navigate to the workflow run page
            if (response.data?.id) {
                router.push(`/workflow/${workflowId}/run/${response.data.id}`);
            }
        } catch (err) {
            logger.error(`Error creating workflow run: ${err}`);
            // Fallback to workflow page if run creation fails
            router.push(`/workflow/${workflowId}`);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-8 max-w-2xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold mb-2">Create Voice Agent</h1>
                    <p className="text-muted-foreground">
                        Tell us about your use case and we&apos;ll create a customized voice agent for you
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Agent Details</CardTitle>
                        <CardDescription>
                            Configure your voice agent settings
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="call-type">Call Type</Label>
                            <Select value={callType} onValueChange={(value) => setCallType(value as 'INBOUND' | 'OUTBOUND')}>
                                <SelectTrigger id="call-type">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="INBOUND">
                                        Inbound (Users call AI)
                                    </SelectItem>
                                    <SelectItem value="OUTBOUND">
                                        Outbound (AI calls users)
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-sm text-muted-foreground">
                                Choose whether users will call your AI or your AI will call users
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="use-case">Use Case</Label>
                            <Input
                                id="use-case"
                                placeholder="e.g., Lead Qualification, HR Screening, Customer Support"
                                value={useCase}
                                onChange={(e) => {
                                    setUseCase(e.target.value);
                                    setUseCaseError(validateUseCase(e.target.value));
                                }}
                                className={useCaseError ? 'border-red-500' : ''}
                            />
                            <div className="flex justify-between items-center">
                                <p className="text-sm text-muted-foreground">
                                    Describe the primary purpose of your voice agent
                                </p>
                                <span className="text-xs text-muted-foreground">
                                    {useCase.length}/50
                                </span>
                            </div>
                            {useCaseError && (
                                <p className="text-sm text-red-500">{useCaseError}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="activity-description">Activity Description</Label>
                            <Textarea
                                id="activity-description"
                                placeholder="Describe briefly what your voice agent will do (e.g., Qualify leads for real estate, Screen candidates for roles, Handle customer support). This will be a prompt to an LLM."
                                value={activityDescription}
                                onChange={(e) => {
                                    setActivityDescription(e.target.value);
                                    setActivityDescriptionError(validateActivityDescription(e.target.value));
                                }}
                                className={`min-h-[100px] ${activityDescriptionError ? 'border-red-500' : ''}`}
                                maxLength={500}
                            />
                            <div className="flex justify-between items-center">
                                <p className="text-sm text-muted-foreground">
                                    This description will be used to generate the AI prompt for your voice agent
                                </p>
                                <span className="text-xs text-muted-foreground">
                                    {activityDescription.length}/500
                                </span>
                            </div>
                            {activityDescriptionError && (
                                <p className="text-sm text-red-500">{activityDescriptionError}</p>
                            )}
                        </div>

                        {error && (
                            <div className="space-y-2">
                                <p className="text-sm text-red-500">{error}</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRetry}
                                    disabled={isLoading}
                                    className="w-full"
                                >
                                    {isLoading ? 'Retrying...' : 'Retry'}
                                </Button>
                            </div>
                        )}

                        <div className="pt-4">
                            <Button
                                onClick={handleCreateWorkflow}
                                disabled={isLoading || !isFormValid()}
                                className="w-full"
                            >
                                {isLoading ? 'Creating...' : 'Create Agent'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Loading Overlay */}
            {isLoading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <Card className="w-full max-w-md p-8">
                        <div className="flex flex-col items-center space-y-6">
                            {/* Animated spinner */}
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-muted rounded-full"></div>
                                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-primary rounded-full animate-spin"></div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full space-y-2">
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>Progress</span>
                                    <span>{loadingProgress}%</span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2">
                                    <div 
                                        className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
                                        style={{ width: `${loadingProgress}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div className="text-center space-y-2">
                                <h3 className="text-lg font-semibold">
                                    Creating Your Workflow
                                </h3>
                                <p className="text-sm text-muted-foreground max-w-xs">
                                    {loadingMessage || "We're setting up your voice agent with your specifications..."}
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Success Modal */}
            <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Workflow Created Successfully!
                        </DialogTitle>
                        <DialogDescription asChild>
                            <div className="mt-4 space-y-4">
                                <p>
                                    A voice agent workflow has been generated for your use case, with some artificial data and sample actions.
                                </p>
                                
                                {/* Workflow Preview */}
                                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                    <h4 className="font-medium text-sm">Workflow Generated</h4>
                                    <div className="text-xs text-muted-foreground space-y-1">
                                        <p>• Type: {callType === 'INBOUND' ? 'Inbound (Users call AI)' : 'Outbound (AI calls users)'}</p>
                                        <p>• Use Case: {useCase}</p>
                                        <p>• Workflow ID: #{workflowId}</p>
                                    </div>
                                </div>

                                <p>
                                    The voice bot is pre-set to communicate in English with an American accent.
                                </p>
                                <p>
                                    Next steps would be to test the voice bot using web call, and then modify it to suit your use case.
                                </p>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-6 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                onClick={handleModalContinue}
                                className="w-full"
                            >
                                Test with Web Call
                            </Button>
                            <Button
                                onClick={handleViewWorkflow}
                                variant="outline"
                                className="w-full"
                            >
                                View & Edit Workflow
                            </Button>
                        </div>
                        <Button
                            onClick={handleCreateAnother}
                            variant="secondary"
                            className="w-full"
                        >
                            Create Another Agent
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
