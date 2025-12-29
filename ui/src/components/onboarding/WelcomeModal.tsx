"use client";

import { Sparkles, X, ArrowRight, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useOnboarding } from '@/context/OnboardingContext';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const { shouldShowWelcomeModal, startOnboarding, getOnboardingSteps, getOnboardingProgress } = useOnboarding();
  const [showModal, setShowModal] = useState(false);
  
  const onboardingSteps = getOnboardingSteps();
  const progress = getOnboardingProgress();

  useEffect(() => {
    if (isOpen && shouldShowWelcomeModal()) {
      setShowModal(true);
    }
  }, [isOpen, shouldShowWelcomeModal]);

  const handleStartTour = () => {
    startOnboarding();
    onClose();
    // Navigate to first step
    const firstStep = onboardingSteps.find(step => !step.completed);
    if (firstStep?.url) {
      window.location.href = firstStep.url;
    }
  };

  const handleSkipTour = () => {
    onClose();
  };

  const handleClose = () => {
    setShowModal(false);
    onClose();
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <Card className="w-full max-w-2xl mx-auto shadow-2xl">
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-2xl">Welcome to Voxora!</CardTitle>
              <CardDescription className="text-lg">
                Your voice AI workflow platform
              </CardDescription>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Your onboarding progress</span>
              <span className="text-muted-foreground">{progress.completed}/{progress.total} steps</span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3">Get started in 5 simple steps</h3>
            <div className="space-y-3">
              {onboardingSteps.map((step, index) => (
                <div key={step.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">
                    {step.completed ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium">{step.title}</h4>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                  {step.url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
                      <Link href={step.url}>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-background p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Quick tips</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Use the visual workflow editor to build voice agents</li>
              <li>• Configure AI models in the Models section</li>
              <li>• Test your agents before deploying to phone numbers</li>
              <li>• Monitor usage and performance in the dashboard</li>
            </ul>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleStartTour}
              className="flex-1"
              size="lg"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Start Tour
            </Button>
            <Button
              variant="outline"
              onClick={handleSkipTour}
              size="lg"
            >
              Skip for now
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            You can always access this guide from the Overview page
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
