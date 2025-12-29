"use client";

import { Clock,Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface RedirectLoaderProps {
  destination?: string;
  destinationName?: string;
  timeout?: number;
  onTimeout?: () => void;
}

export default function RedirectLoader({
  destination = "/overview",
  destinationName = "your dashboard",
  timeout = 3000,
  onTimeout
}: RedirectLoaderProps) {
  const [progress, setProgress] = useState(0);
  const [showTimeoutButton, setShowTimeoutButton] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(timeout / 1000);

  useEffect(() => {
    const interval = 50; // Update every 50ms for smooth progress
    const totalSteps = timeout / interval;
    let currentStep = 0;

    const progressInterval = setInterval(() => {
      currentStep++;
      const newProgress = (currentStep / totalSteps) * 100;
      setProgress(newProgress);
      setTimeRemaining(Math.ceil((timeout - currentStep * interval) / 1000));

      if (currentStep >= totalSteps) {
        clearInterval(progressInterval);
        setShowTimeoutButton(true);
        if (onTimeout) {
          onTimeout();
        }
      }
    }, interval);

    return () => clearInterval(progressInterval);
  }, [timeout, onTimeout]);

  const handleManualRedirect = () => {
    window.location.href = destination;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
          <CardTitle className="text-xl">Redirecting...</CardTitle>
          <CardDescription>
            Taking you to {destinationName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Loading</span>
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeRemaining}s
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Manual redirect button if timeout */}
          {showTimeoutButton && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">
                Taking longer than expected?
              </p>
              <Button
                onClick={handleManualRedirect}
                className="w-full"
              >
                Continue to {destinationName}
              </Button>
            </div>
          )}

          {/* Additional info */}
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>If you're not redirected automatically, click the button above.</p>
            <p>This should only take a few seconds.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
