'use client';

import { useState } from 'react';
import { PlusIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CreateFromTemplateDialog } from './CreateFromTemplateDialog';

export function CreateWorkflowButton() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    return (
        <>
            <Button onClick={() => setIsDialogOpen(true)}>
                <PlusIcon className="w-4 h-4" />
                Create Agent
            </Button>
            
            <CreateFromTemplateDialog 
                open={isDialogOpen} 
                onOpenChange={setIsDialogOpen} 
            />
        </>
    );
}
