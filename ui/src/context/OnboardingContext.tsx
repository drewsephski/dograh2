'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type TooltipKey = 'web_call' | 'customize_workflow' | 'create_workflow' | 'configure_models' | 'test_agent' | 'deploy_phone' | 'monitor_usage';

export type OnboardingStep = {
    id: string;
    title: string;
    description: string;
    completed: boolean;
    url?: string;
};

interface OnboardingState {
    seenTooltips: TooltipKey[];
    completedSteps: string[];
    welcomeModalShown: boolean;
    startedOnboarding: boolean;
    completedOnboarding: boolean;
    lastActiveStep?: string;
}

interface OnboardingContextType {
    hasSeenTooltip: (key: TooltipKey) => boolean;
    markTooltipSeen: (key: TooltipKey) => void;
    resetOnboarding: () => void;
    // New onboarding methods
    markStepCompleted: (stepId: string) => void;
    isStepCompleted: (stepId: string) => boolean;
    getOnboardingProgress: () => { completed: number; total: number; percentage: number };
    setWelcomeModalShown: () => void;
    shouldShowWelcomeModal: () => boolean;
    startOnboarding: () => void;
    completeOnboarding: () => void;
    getOnboardingSteps: () => OnboardingStep[];
    setCurrentStep: (stepId: string) => void;
    getCurrentStep: () => string | undefined;
}

const ONBOARDING_STORAGE_KEY = 'dograh_onboarding_state';

const defaultState: OnboardingState = {
    seenTooltips: [],
    completedSteps: [],
    welcomeModalShown: false,
    startedOnboarding: false,
    completedOnboarding: false,
};

const ONBOARDING_STEPS: OnboardingStep[] = [
    {
        id: 'create_workflow',
        title: 'Create your first workflow',
        description: 'Build a voice AI agent using our visual workflow editor',
        completed: false,
        url: '/workflow/create'
    },
    {
        id: 'configure_models',
        title: 'Configure AI models',
        description: 'Set up LLM, TTS, and STT providers for your agents',
        completed: false,
        url: '/model-configurations'
    },
    {
        id: 'test_agent',
        title: 'Test your voice agent',
        description: 'Try out your agent with our testing tools',
        completed: false,
        url: '/workflow'
    },
    {
        id: 'deploy_phone',
        title: 'Deploy to phone',
        description: 'Connect your agent to a phone number',
        completed: false,
        url: '/telephony-configurations'
    },
    {
        id: 'monitor_usage',
        title: 'Monitor usage',
        description: 'Track your agent performance and usage metrics',
        completed: false,
        url: '/usage'
    },
];

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider = ({ children }: { children: React.ReactNode }) => {
    const [onboardingState, setOnboardingState] = useState<OnboardingState>(() => {
        // Initialize state from localStorage on first render
        if (typeof window !== 'undefined') {
            const savedState = localStorage.getItem(ONBOARDING_STORAGE_KEY);
            if (savedState) {
                try {
                    const parsed = JSON.parse(savedState);
                    return { ...defaultState, ...parsed };
                } catch (error) {
                    console.error('Failed to parse onboarding state:', error);
                }
            }
        }
        return defaultState;
    });

    // Save state to localStorage whenever it changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(onboardingState));
        }
    }, [onboardingState]);

    const hasSeenTooltip = (key: TooltipKey): boolean => {
        return onboardingState.seenTooltips.includes(key);
    };

    const markTooltipSeen = (key: TooltipKey) => {
        setOnboardingState(prev => ({
            ...prev,
            seenTooltips: prev.seenTooltips.includes(key)
                ? prev.seenTooltips
                : [...prev.seenTooltips, key]
        }));
    };

    const markStepCompleted = (stepId: string) => {
        setOnboardingState(prev => {
            const newCompletedSteps = prev.completedSteps.includes(stepId)
                ? prev.completedSteps
                : [...prev.completedSteps, stepId];
            
            const allStepsCompleted = ONBOARDING_STEPS.every(step => newCompletedSteps.includes(step.id));
            
            return {
                ...prev,
                completedSteps: newCompletedSteps,
                completedOnboarding: allStepsCompleted,
                lastActiveStep: stepId
            };
        });
    };

    const isStepCompleted = (stepId: string): boolean => {
        return onboardingState.completedSteps.includes(stepId);
    };

    const getOnboardingProgress = () => {
        const completed = onboardingState.completedSteps.length;
        const total = ONBOARDING_STEPS.length;
        const percentage = total > 0 ? (completed / total) * 100 : 0;
        return { completed, total, percentage };
    };

    const setWelcomeModalShown = () => {
        setOnboardingState(prev => ({ ...prev, welcomeModalShown: true }));
    };

    const shouldShowWelcomeModal = (): boolean => {
        return !onboardingState.welcomeModalShown && !onboardingState.startedOnboarding;
    };

    const startOnboarding = () => {
        setOnboardingState(prev => ({ 
            ...prev, 
            startedOnboarding: true,
            welcomeModalShown: true 
        }));
    };

    const completeOnboarding = () => {
        setOnboardingState(prev => ({ 
            ...prev, 
            completedOnboarding: true,
            completedSteps: ONBOARDING_STEPS.map(step => step.id)
        }));
    };

    const getOnboardingSteps = (): OnboardingStep[] => {
        return ONBOARDING_STEPS.map(step => ({
            ...step,
            completed: onboardingState.completedSteps.includes(step.id)
        }));
    };

    const setCurrentStep = (stepId: string) => {
        setOnboardingState(prev => ({ ...prev, lastActiveStep: stepId }));
    };

    const getCurrentStep = (): string | undefined => {
        return onboardingState.lastActiveStep;
    };

    const resetOnboarding = () => {
        setOnboardingState(defaultState);
        if (typeof window !== 'undefined') {
            localStorage.removeItem(ONBOARDING_STORAGE_KEY);
        }
    };

    return (
        <OnboardingContext.Provider
            value={{
                hasSeenTooltip,
                markTooltipSeen,
                resetOnboarding,
                markStepCompleted,
                isStepCompleted,
                getOnboardingProgress,
                setWelcomeModalShown,
                shouldShowWelcomeModal,
                startOnboarding,
                completeOnboarding,
                getOnboardingSteps,
                setCurrentStep,
                getCurrentStep
            }}
        >
            {children}
        </OnboardingContext.Provider>
    );
};

export const useOnboarding = () => {
    const context = useContext(OnboardingContext);
    if (!context) {
        throw new Error('useOnboarding must be used within an OnboardingProvider');
    }
    return context;
};
