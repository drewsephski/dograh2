'use client';

import { MessageSquare, Play } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SCENARIOS = [
  {
    name: "Budget Inquiry",
    description: "Customer asks about budget range",
    messages: [
      "Hi, I'm looking for a 3-bedroom house",
      "My budget is around $500,000",
      "I'd like to see properties next weekend"
    ]
  },
  {
    name: "Timeline Question", 
    description: "Customer needs to move soon",
    messages: [
      "I need to move in 2 months",
      "What's available in downtown?",
      "Can you send me some listings?"
    ]
  },
  {
    name: "Property Type",
    description: "Customer wants specific property features",
    messages: [
      "I'm looking for a condo with a view",
      "Need at least 2 bedrooms and parking",
      "Is there a gym in the building?"
    ]
  },
  {
    name: "First-time Buyer",
    description: "Customer is new to real estate",
    messages: [
      "I've never bought a house before",
      "What's the process like?",
      "Do I need to get pre-approved first?"
    ]
  }
];

interface TestScenariosProps {
  onScenarioSelect?: (scenario: typeof SCENARIOS[0]) => void;
  isCallActive?: boolean;
}

export function TestScenarios({ onScenarioSelect, isCallActive = false }: TestScenariosProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Test Scenarios
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {SCENARIOS.map((scenario, index) => (
            <div key={index} className="border rounded-lg p-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium">{scenario.name}</h4>
                  <p className="text-sm text-muted-foreground">{scenario.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onScenarioSelect?.(scenario)}
                  disabled={isCallActive}
                  className="flex items-center gap-1"
                >
                  <Play className="w-3 h-3" />
                  Use
                </Button>
              </div>
              
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Sample conversation:</p>
                {scenario.messages.map((message, msgIndex) => (
                  <div key={msgIndex} className="text-xs text-muted-foreground pl-2 border-l-2 border-muted">
                    {message}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Tip:</strong> Click "Use" to auto-populate the conversation and see how your agent responds to different scenarios.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
