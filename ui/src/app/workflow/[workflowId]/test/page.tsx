'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createWorkflowRunApiV1WorkflowWorkflowIdRunsPost } from '@/client/sdk.gen';
import { TestScenarios } from '@/components/workflow/TestScenarios';
import { useWebSocketRTC } from '@/app/workflow/[workflowId]/run/[runId]/hooks';
import { useAuth } from '@/lib/auth';

interface TestMessage {
  speaker: 'user' | 'agent';
  text: string;
  timestamp: Date;
}

export default function WorkflowTestPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = parseInt(params.workflowId as string);
  
  const auth = useAuth();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [workflowRunId, setWorkflowRunId] = useState<number | null>(null);
  const [messages, setMessages] = useState<TestMessage[]>([]);
  
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Get access token
  useEffect(() => {
    if (auth.isAuthenticated && !auth.loading) {
      auth.getAccessToken().then(setAccessToken);
    }
  }, [auth]);

  // Initialize WebSocket RTC connection when we have a workflow run
  const {
    audioRef,
    connectionActive,
    connectionStatus,
    start,
    stop,
    isStarting,
    selectedAudioInput,
    setSelectedAudioInput,
    audioInputs,
    permissionError,
  } = useWebSocketRTC({
    workflowId,
    workflowRunId: workflowRunId || 0,
    accessToken,
    initialContextVariables: {},
    onTranscriptUpdate: (role, content, timestamp) => {
      // Add real-time transcript messages
      const newMessage: TestMessage = {
        speaker: role === 'user' ? 'user' : 'agent',
        text: content,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
    },
  });

  // Update remote audio ref when connection is active
  useEffect(() => {
    if (audioRef.current && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = audioRef.current.srcObject;
    }
  }, [audioRef, connectionActive]);

  const startTestCall = async () => {
    if (!accessToken) return;
    
    try {
      // Create a workflow run in test mode
      const response = await createWorkflowRunApiV1WorkflowWorkflowIdRunsPost({
        path: {
          workflow_id: workflowId,
        },
        body: {
          name: 'Test Call',
          mode: 'webrtc_test',
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.data) {
        setWorkflowRunId(response.data.id);
        // Start the WebRTC connection
        await start();
      }
    } catch (error) {
      console.error('Failed to start test call:', error);
    }
  };

  const endTestCall = () => {
    stop();
    setWorkflowRunId(null);
    setMessages([]);
  };

  const toggleMute = () => {
    // TODO: Implement actual microphone mute/unmute using WebRTC
    if (audioInputs.length > 0) {
      // Toggle between current input and first available input (unmute)
      const nextInput = selectedAudioInput ? undefined : audioInputs[0]?.deviceId;
      setSelectedAudioInput(nextInput || '');
    }
  };

  const toggleSpeaker = () => {
    // TODO: Implement actual speaker volume control
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !remoteAudioRef.current.muted;
    }
  };

  const handleScenarioSelect = (scenario: any) => {
    // Add scenario messages to the conversation
    const scenarioMessages: TestMessage[] = scenario.messages.map((text: string, index: number) => ({
      speaker: index % 2 === 0 ? 'user' : 'agent',
      text,
      timestamp: new Date(),
    }));
    
    setMessages(prev => [...prev, ...scenarioMessages]);
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Test Your Agent</h1>
          <p className="text-muted-foreground mt-2">
            Test your real estate agent using WebRTC - no phone required
          </p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          Back to Agent
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Test Controls */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Test Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!connectionActive ? (
              <Button 
                onClick={startTestCall} 
                disabled={isStarting || !accessToken}
                className="w-full"
                size="lg"
              >
                <Phone className="w-4 h-4 mr-2" />
                {isStarting ? 'Starting...' : 'Start Test Call'}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-center">
                  <Badge variant="default" className="animate-pulse">
                    Connected
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleMute}
                    className={!selectedAudioInput ? 'bg-red-50 border-red-200' : ''}
                  >
                    {!selectedAudioInput ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSpeaker}
                    className={remoteAudioRef.current?.muted ? 'bg-red-50 border-red-200' : ''}
                  >
                    {!remoteAudioRef.current?.muted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </Button>
                </div>
                
                <Button 
                  onClick={endTestCall} 
                  variant="destructive"
                  className="w-full"
                >
                  <PhoneOff className="w-4 h-4 mr-2" />
                  End Call
                </Button>
              </div>
            )}
            
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Test Tips:</p>
              <ul className="space-y-1">
                <li>• Speak clearly into your microphone</li>
                <li>• Test different property inquiries</li>
                <li>• Ask about budget and timeline</li>
                <li>• Request appointment booking</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Conversation Transcript */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Live Transcript</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96 overflow-y-auto space-y-4 border rounded-lg p-4 bg-muted/50">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Start a test call to see the conversation transcript</p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.speaker === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">
                          {message.speaker === 'user' ? 'You' : 'Agent'}
                        </span>
                        <span className="text-xs opacity-70">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm">{message.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Hidden audio elements for WebRTC */}
            <audio ref={localAudioRef} autoPlay muted />
            <audio ref={remoteAudioRef} autoPlay />
          </CardContent>
        </Card>
      </div>

      {/* Test Scenarios */}
      <div className="mt-8">
        <TestScenarios 
          onScenarioSelect={handleScenarioSelect}
          isCallActive={connectionActive}
        />
      </div>
    </div>
  );
}
