'use client';

import { useState } from 'react';
import { Phone, Plus, CheckCircle, AlertCircle } from 'lucide-react';

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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';

interface DeployToPhoneDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workflowId: number;
    workflowName: string;
}

export function DeployToPhoneDialog({ open, onOpenChange, workflowId, workflowName }: DeployToPhoneDialogProps) {
    const [isDeploying, setIsDeploying] = useState(false);
    const [deploymentOption, setDeploymentOption] = useState<'new' | 'existing'>('new');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [areaCode, setAreaCode] = useState('');
    const [deployedNumber, setDeployedNumber] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleDeploy = async () => {
        setIsDeploying(true);
        setError(null);
        
        try {
            if (deploymentOption === 'new') {
                // Provision new number from Twilio
                const requestBody: any = {
                    action: 'provision_number',
                };
                
                // Add area code if provided
                if (areaCode.trim()) {
                    requestBody.area_code = areaCode.trim();
                }
                
                const response = await fetch(`/api/v1/workflow/${workflowId}/deploy`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                });

                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.detail || data.message || 'Failed to provision number');
                }
                
                setDeployedNumber(data.phone_number);
            } else {
                // Use existing number
                if (!phoneNumber.trim()) {
                    setError('Please enter a phone number');
                    return;
                }

                const response = await fetch(`/api/v1/workflow/${workflowId}/deploy`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'use_existing',
                        phone_number: phoneNumber.trim(),
                    }),
                });

                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.detail || data.message || 'Failed to configure existing number');
                }
                
                setDeployedNumber(data.phone_number);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Deployment failed');
        } finally {
            setIsDeploying(false);
        }
    };

    const handleClose = () => {
        onOpenChange(false);
        // Reset state
        setDeploymentOption('new');
        setPhoneNumber('');
        setAreaCode('');
        setDeployedNumber(null);
        setError(null);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Phone className="w-5 h-5" />
                        Deploy to Phone
                    </DialogTitle>
                    <DialogDescription>
                        Make {workflowName} available for incoming calls
                    </DialogDescription>
                </DialogHeader>

                {!deployedNumber ? (
                    <div className="space-y-6 py-4">
                        {/* Deployment Options */}
                        <RadioGroup value={deploymentOption} onValueChange={(value: 'new' | 'existing') => setDeploymentOption(value)}>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="new" id="new" />
                                <Label htmlFor="new" className="flex-1 cursor-pointer">
                                    <div className="font-medium">Provision New Number</div>
                                    <div className="text-sm text-muted-foreground">
                                        Get a new phone number from Twilio (automatically configured)
                                    </div>
                                </Label>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="existing" id="existing" />
                                <Label htmlFor="existing" className="flex-1 cursor-pointer">
                                    <div className="font-medium">Use Existing Number</div>
                                    <div className="text-sm text-muted-foreground">
                                        Configure a Twilio number you already own
                                    </div>
                                </Label>
                            </div>
                        </RadioGroup>

                        {/* Area Code Input for New Number */}
                        {deploymentOption === 'new' && (
                            <div className="space-y-2">
                                <Label htmlFor="area-code">Area Code (Optional)</Label>
                                <Input
                                    id="area-code"
                                    placeholder="e.g., 415, 212, 310"
                                    value={areaCode}
                                    onChange={(e) => setAreaCode(e.target.value)}
                                    disabled={isDeploying}
                                    maxLength={3}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Preferred area code for the new phone number (3 digits). Leave blank for any area.
                                </p>
                            </div>
                        )}

                        {/* Existing Number Input */}
                        {deploymentOption === 'existing' && (
                            <div className="space-y-2">
                                <Label htmlFor="phone-number">Phone Number</Label>
                                <Input
                                    id="phone-number"
                                    placeholder="+1-555-123-4567"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    disabled={isDeploying}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Enter your Twilio phone number in E.164 format (+1-XXX-XXX-XXXX)
                                </p>
                            </div>
                        )}

                        {/* Error Display */}
                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <AlertCircle className="w-4 h-4 text-red-600" />
                                <span className="text-sm text-red-800">{error}</span>
                            </div>
                        )}

                        {/* Deployment Info */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <h4 className="font-medium text-blue-900 mb-2">What happens next:</h4>
                            <ul className="text-sm text-blue-800 space-y-1">
                                <li>We will configure the number to point to your agent</li>
                                <li>Calls will be handled by the Dograh platform</li>
                                <li>You can view call logs and recordings in the dashboard</li>
                                <li>Standard Twilio rates will apply for calls</li>
                            </ul>
                        </div>
                    </div>
                ) : (
                    // Success State
                    <div className="space-y-4 py-4">
                        <div className="flex items-center justify-center p-6 bg-green-50 border border-green-200 rounded-lg">
                            <CheckCircle className="w-12 h-12 text-green-600 mr-4" />
                            <div>
                                <h3 className="font-medium text-green-900">Deployment Successful!</h3>
                                <p className="text-green-800">Your agent is now live</p>
                            </div>
                        </div>

                        <div className="text-center">
                            <Label className="text-sm text-muted-foreground">Your agent is available at:</Label>
                            <div className="mt-2">
                                <Badge variant="default" className="text-lg px-4 py-2">
                                    {deployedNumber}
                                </Badge>
                            </div>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-4">
                            <h4 className="font-medium mb-2">Next Steps:</h4>
                            <ul className="text-sm space-y-1">
                                <li>Call the number to test your agent</li>
                                <li>Monitor call logs in the dashboard</li>
                                <li>View recordings and transcripts</li>
                                <li>Update your agent anytime from the workflow editor</li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={handleClose} disabled={isDeploying}>
                        {deployedNumber ? 'Close' : 'Cancel'}
                    </Button>
                    {!deployedNumber && (
                        <Button onClick={handleDeploy} disabled={isDeploying}>
                            {isDeploying ? 'Deploying...' : 'Deploy Agent'}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
