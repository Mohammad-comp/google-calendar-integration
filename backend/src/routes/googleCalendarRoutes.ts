// backend/src/routes/googleCalendarRoutes.ts
import express from 'express';
import { google } from 'googleapis';

const router = express.Router();

console.log({
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  redirect_uri: process.env.GOOGLE_REDIRECT_URI,
});

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_REDIRECT_URI!
);

// Redirect user to Google consent screen
router.get('/auth/google-calendar', (req, res) => {
  console.log('Redirect URI:', process.env.GOOGLE_REDIRECT_URI);
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
  });
  res.redirect(url);
});

// Handle Google OAuth callback
router.get('/callback', async (req, res) => {
  const code = req.query.code as string;
  console.log('✅ Callback hit. Code:', code);

  if (!code) {
    console.error('❌ No code received in callback');
    return res.status(400).send('Missing code');
  }

  try {
    console.log('🌐 Trying to exchange code for tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    console.log('✅ Tokens received:', tokens);

    oauth2Client.setCredentials(tokens);
    console.log('🔑 Credentials set successfully.');

    // ✅ THIS IS THE REDIRECT YOU WANT
res.redirect('http://localhost:8080/global-settings?googleConnected=true');

  } catch (error) {
    console.error('❌ OAuth error during token exchange:', error);
    res.status(500).send('Authentication failed');
  }
});

export default router;