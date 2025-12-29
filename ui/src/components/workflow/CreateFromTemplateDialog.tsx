'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, User, Calendar, Phone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    duplicateWorkflowTemplateApiV1WorkflowTemplatesDuplicatePost,
    getWorkflowTemplatesApiV1WorkflowTemplatesGet,
} from '@/client/sdk.gen';
import type {
    DuplicateWorkflowTemplateApiV1WorkflowTemplatesDuplicatePostData,
    DuplicateTemplateRequest,
    WorkflowTemplateResponse,
} from '@/client/types.gen';

interface CreateFromTemplateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateFromTemplateDialog({ open, onOpenChange }: CreateFromTemplateDialogProps) {
    const router = useRouter();
    const [isCreating, setIsCreating] = useState(false);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
    const [templates, setTemplates] = useState<WorkflowTemplateResponse[]>([]);
    const [realEstateTemplate, setRealEstateTemplate] = useState<WorkflowTemplateResponse | null>(null);
    const [agencyName, setAgencyName] = useState('');
    const [agentName, setAgentName] = useState('');
    const [calendarLink, setCalendarLink] = useState('');

    // Load templates when dialog opens
    useEffect(() => {
        if (open) {
            loadTemplates();
        }
    }, [open]);

    const loadTemplates = async () => {
        setIsLoadingTemplates(true);
        try {
            const response = await getWorkflowTemplatesApiV1WorkflowTemplatesGet();
            if (response.data) {
                setTemplates(response.data);
                // Find the Real Estate template
                const template = response.data.find(t => t.template_name === "Real Estate Lead Qualifier");
                setRealEstateTemplate(template || null);
            }
        } catch (error) {
            console.error('Failed to load templates:', error);
        } finally {
            setIsLoadingTemplates(false);
        }
    };

    const handleCreateAgent = async () => {
        if (!agencyName.trim() || !realEstateTemplate) {
            return;
        }

        setIsCreating(true);
        try {
            // Use the dynamically loaded Real Estate template
            const response = await duplicateWorkflowTemplateApiV1WorkflowTemplatesDuplicatePost({
                body: {
                    template_id: realEstateTemplate.id,
                    workflow_name: `${agencyName} - Real Estate Agent`,
                } as DuplicateTemplateRequest,
            });

            if (response.data) {
                // Navigate to the newly created workflow
                router.push(`/workflow/${response.data.id}`);
                onOpenChange(false);
                
                // Reset form
                setAgencyName('');
                setAgentName('');
                setCalendarLink('');
            }
        } catch (error) {
            console.error('Failed to create agent from template:', error);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        Create Real Estate Agent
                    </DialogTitle>
                    <DialogDescription>
                        Create a professional real estate assistant that qualifies leads and books appointments.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Template Preview */}
                    <div className="bg-muted/50 rounded-lg p-4">
                        {isLoadingTemplates ? (
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                                <p className="text-sm text-muted-foreground">Loading templates...</p>
                            </div>
                        ) : !realEstateTemplate ? (
                            <div className="text-center">
                                <p className="text-sm text-red-600">Real Estate Lead Qualifier template not found</p>
                                <p className="text-xs text-muted-foreground mt-1">Please ensure the template is available</p>
                            </div>
                        ) : (
                            <>
                                <h4 className="font-medium mb-2">Real Estate Lead Qualifier</h4>
                                <p className="text-sm text-muted-foreground mb-3">
                                    This agent will:
                                </p>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                    <li>• Greet callers warmly</li>
                                    <li>• Ask about property preferences</li>
                                    <li>• Confirm budget range</li>
                                    <li>• Ask preferred timeline</li>
                                    <li>• Offer to book viewings</li>
                                </ul>
                            </>
                        )}
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="agency-name" className="flex items-center gap-2">
                                <Building2 className="w-4 h-4" />
                                Agency Name *
                            </Label>
                            <Input
                                id="agency-name"
                                placeholder="e.g., Downtown Realty"
                                value={agencyName}
                                onChange={(e) => setAgencyName(e.target.value)}
                                disabled={isCreating}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="agent-name" className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Agent Name
                            </Label>
                            <Input
                                id="agent-name"
                                placeholder="e.g., Sarah Johnson"
                                value={agentName}
                                onChange={(e) => setAgentName(e.target.value)}
                                disabled={isCreating}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="calendar-link" className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Calendar Link (Optional)
                            </Label>
                            <Textarea
                                id="calendar-link"
                                placeholder="Link to your booking calendar..."
                                value={calendarLink}
                                onChange={(e) => setCalendarLink(e.target.value)}
                                disabled={isCreating}
                                rows={2}
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isCreating}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateAgent}
                        disabled={!agencyName.trim() || isCreating || isLoadingTemplates || !realEstateTemplate}
                        className="flex items-center gap-2"
                    >
                        <Phone className="w-4 h-4" />
                        {isCreating ? 'Creating...' : isLoadingTemplates ? 'Loading Templates...' : 'Create Agent'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
