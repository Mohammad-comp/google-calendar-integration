// src/components/settings/GoogleCalendarIntegration.tsx

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const GoogleCalendarIntegration = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check URL params for googleConnected
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('googleConnected') === 'true') {
      setIsConnected(true);
      toast({
        title: "Google Calendar connected",
        description: "Your Google Calendar integration has been set up successfully.",
      });
    }
  }, []);

  const handleConnect = () => {
    window.location.href = 'http://localhost:3001/api/google-calendar/auth/google-calendar';
  };

  const handleDisconnect = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsConnected(false);
      setIsLoading(false);
      toast({
        title: "Google Calendar disconnected",
        description: "Your Google Calendar integration has been removed.",
      });
    }, 1000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Calendar Integration</CardTitle>
        <CardDescription>
          Connect your Google Calendar to enable scheduling
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-muted/50 p-4 rounded-md text-sm">
          <p>
            Connect your Google Calendar to allow your AI agents to schedule appointments and meetings.
          </p>
          <a
            href="https://calendar.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-usaev-red inline-flex items-center mt-2 hover:underline"
          >
            Learn more about Google Calendar
            <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </div>

        {isConnected ? (
          <div className="space-y-4">
            <div className="rounded-md bg-green-50 p-4 border border-green-200">
              <p className="text-green-800 text-sm font-medium">
                Your Google Calendar account is connected.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isLoading}
            >
              {isLoading ? "Disconnecting..." : "Disconnect Calendar"}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            className="bg-usaev-red hover:bg-red-700"
            onClick={handleConnect}
            disabled={isLoading}
          >
            {isLoading ? "Connecting..." : "Connect Google Calendar"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default GoogleCalendarIntegration;