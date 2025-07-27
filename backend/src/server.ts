import dotenv from 'dotenv';
dotenv.config();

// backend/src/server.ts
import googleCalendarRoutes from './routes/googleCalendarRoutes';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import route handlers
import { getTwilioPhoneNumbers, getAvailablePhoneNumbers, purchasePhoneNumber } from './api/integrations/twilio/phone-numbers';
import { validateTwilioCredentialsSimple, testTwilioConnection } from './api/integrations/twilio/validate-simple';
import { makeTestCall, handleTestCallStatus, getTestCallResults, makeBulkTestCalls } from './api/voice/test-call';

import { getGHLCalendars } from './api/integrations/gohighlevel/calendars';
import { getElevenLabsVoices } from './api/integrations/elevenlabs/voices';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8080', 'http://localhost:5173', 'https://id-preview--626f45fa-6a94-46a4-aba2-c6e3bea6d6e9.lovable.app'], // Add your frontend URLs
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/google-calendar', googleCalendarRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'usaev-voice-api'
  });
});

// Twilio integration routes
app.post('/api/integrations/twilio/phone-numbers', getTwilioPhoneNumbers);
app.post('/api/integrations/twilio/validate', validateTwilioCredentialsSimple);
app.post('/api/integrations/twilio/test-connection', testTwilioConnection);
app.post('/api/integrations/twilio/available-numbers', getAvailablePhoneNumbers);
app.post('/api/integrations/twilio/purchase-number', purchasePhoneNumber);

// GoHighLevel integration routes
app.post('/api/integrations/gohighlevel/calendars', getGHLCalendars);

// ElevenLabs integration routes
app.post('/api/integrations/elevenlabs/voices', getElevenLabsVoices)

// Global call sessions storage (in production, use Redis or database)
const callSessions = new Map();

// Voice call routes - these will be created dynamically per request
app.post('/api/voice/outbound-call', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { 
			agentId, 
			to,
			from,
			contactInfo, 
			twilioCredentials, 
			openaiApiKey } = req.body;

    if (!twilioCredentials || !twilioCredentials.ssid || !twilioCredentials.authToken) {
      res.status(400).json({
        success: false,
        message: 'Twilio credentials are required'
      });
      return;
    }

    if (!openaiApiKey) {
      res.status(400).json({
        success: false,
        message: 'OpenAI API key is required'
      });
      return;
    }

    if (!to) {
      res.status(400).json({
        success: false,
        message: 'Destination phone number is required'
      });
      return;
    }

    // Import and initialize voice handler with provided credentials
    const twilio = require('twilio');
    const client = twilio(twilioCredentials.ssid, twilioCredentials.authToken);

    // Create a simple call with direct TwiML (no webhooks needed)
    const call = await client.calls.create({
      to: to,
      from: from,
      twiml: '<Response><Say voice="alice">Hello! This is your AI assistant calling. This is a test call from your system. Everything is working correctly. Thank you for testing!</Say></Response>',
      record: false
    });

    console.log(`Call initiated: ${call.sid}`);

    // Store call session for AI processing
    callSessions.set(call.sid, {
      agentId,
      openaiApiKey,
      twilioCredentials,
      contactInfo,
      conversationHistory: []
    });

    res.json({
      success: true,
      callId: call.sid,
      message: 'Call initiated successfully',
      from: from,
      to: to
    });

  } catch (error: any) {
    console.error('Error in outbound call:', error);
    res.status(500).json({
      success: false,
      message: `Failed to initiate call: ${error.message}`
    });
  }
});

// Speech processing endpoint
app.post('/api/voice/process-speech/:agentId', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { agentId } = req.params;
    const speechResult = req.body.SpeechResult;
    const callSid = req.body.CallSid;
    
    console.log(`Processing speech for agent ${agentId}, call ${callSid}: "${speechResult}"`);
    
    if (!speechResult) {
      const twilio = require('twilio');
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say('I didn\'t hear anything. Please speak your question or concern.');
      
      twiml.gather({
        input: ['speech'],
        action: `/api/voice/process-speech/${agentId}`,
        speechTimeout: '3',
        speechModel: 'experimental_conversations'
      });

      res.type('text/xml');
      res.send(twiml.toString());
      return;
    }

    // Get call session data
    const session = callSessions.get(callSid);
    if (!session) {
      console.error('No session found for call:', callSid);
      const twilio = require('twilio');
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say('I apologize, but I encountered an error. Please try again.');
      res.type('text/xml');
      res.send(twiml.toString());
      return;
    }

    // Add user message to conversation history
    session.conversationHistory.push({ role: 'user', content: speechResult });

    // Generate AI response using OpenAI
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: session.openaiApiKey });

    const messages = [
      {
        role: 'system',
        content: 'You are a helpful AI assistant. Keep responses concise and natural for phone conversations. Be friendly and professional.'
      },
      ...session.conversationHistory
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 150,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0]?.message?.content || 'I apologize, but I didn\'t understand that.';
    
    // Add AI response to conversation history
    session.conversationHistory.push({ role: 'assistant', content: aiResponse });

    console.log(`AI Response: "${aiResponse}"`);

    // Create TwiML response
    const twilio = require('twilio');
    const twiml = new twilio.twiml.VoiceResponse();
    
    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, aiResponse);
    
    twiml.gather({
      input: ['speech'],
      action: `/api/voice/process-speech/${agentId}`,
      speechTimeout: '3',
      speechModel: 'experimental_conversations'
    });

    res.type('text/xml');
    res.send(twiml.toString());

  } catch (error: any) {
    console.error('Error processing speech:', error);
    const twilio = require('twilio');
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('I apologize, but I encountered an error. Please try again.');
    res.type('text/xml');
    res.send(twiml.toString());
  }
});

// Call status webhook
app.post('/api/voice/status', (req, res) => {
  const { CallSid, CallStatus } = req.body;
  console.log(`Call ${CallSid} status: ${CallStatus}`);
  res.sendStatus(200);
});

// Test call routes
app.post('/api/voice/test-call', makeTestCall);
app.post('/api/voice/test-status', handleTestCallStatus);
app.get('/api/voice/test-results/:callId', getTestCallResults);
app.post('/api/voice/bulk-test-calls', makeBulkTestCalls);

// Call status endpoint
app.get('/api/voice/call-status/:callId', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { callId } = req.params;
    const { twilioSsid, twilioAuthToken } = req.query;

    if (!twilioSsid || !twilioAuthToken) {
      res.status(400).json({
        success: false,
        message: 'Twilio credentials required'
      });
      return;
    }
    
    const twilio = require('twilio');
    const client = twilio(twilioSsid, twilioAuthToken);
    const call = await client.calls(callId).fetch();
    
    res.json({
      success: true,
      call: {
        sid: call.sid,
        status: call.status,
        direction: call.direction,
        from: call.from,
        to: call.to,
        startTime: call.startTime,
        endTime: call.endTime,
        duration: call.duration,
        price: call.price,
        priceUnit: call.priceUnit
      }
    });
  } catch (error: any) {
    console.error('Error fetching call status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch call status'
    });
  }
});

// End call endpoint
app.post('/api/voice/end-call/:callId', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { callId } = req.params;
    const { twilioSsid, twilioAuthToken } = req.body;

    if (!twilioSsid || !twilioAuthToken) {
      res.status(400).json({
        success: false,
        message: 'Twilio credentials required'
      });
      return;
    }
    
    const twilio = require('twilio');
    const client = twilio(twilioSsid, twilioAuthToken);
    const call = await client.calls(callId).update({ status: 'completed' });
    
    res.json({
      success: true,
      message: 'Call ended successfully',
      call: {
        sid: call.sid,
        status: call.status
      }
    });
  } catch (error: any) {
    console.error('Error ending call:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end call'
    });
  }
});

// Call history endpoint
app.get('/api/voice/call-history', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { agentId, limit = '50', twilioSsid, twilioAuthToken } = req.query;

    if (!twilioSsid || !twilioAuthToken) {
      res.status(400).json({
        success: false,
        message: 'Twilio credentials required'
      });
      return;
    }
    
    const twilio = require('twilio');
    const client = twilio(twilioSsid, twilioAuthToken);
    const calls = await client.calls.list({
      limit: parseInt(limit as string)
    });
    
    const formattedCalls = calls.map((call: any) => ({
      sid: call.sid,
      status: call.status,
      direction: call.direction,
      from: call.from,
      to: call.to,
      startTime: call.startTime,
      endTime: call.endTime,
      duration: call.duration,
      price: call.price
    }));
    
    res.json({
      success: true,
      calls: formattedCalls,
      total: formattedCalls.length
    });
  } catch (error: any) {
    console.error('Error fetching call history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch call history'
    });
  }
});

// Incoming call webhook handler
app.post('/api/voice/incoming', (req, res) => {
  const twilio = require('twilio');
  const twiml = new twilio.twiml.VoiceResponse();
  
  twiml.say('Thank you for calling. Please hold while we connect you to an AI agent.');
  twiml.redirect('/api/voice/twiml/default-agent');
  
  res.type('text/xml');
  res.send(twiml.toString());
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 USAEV Voice API server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📞 Ready to accept voice calls with dynamic credentials`);
});



export default app;