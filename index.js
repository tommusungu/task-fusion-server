const express = require('express');
const path = require('path');
const { google } = require('googleapis');
const { oauth2Client, setTokens } = require('./googleAuth');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Use middlewares

app.use(cors({ 
  origin: ["https://tasky-c12c0.web.app", "http://localhost:8000"], 
  credentials: true 
}));

app.use(cookieParser());

// Step 1: Redirect to Google authentication
app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
  });
  console.log('Redirecting to Google authentication...');
  res.redirect(authUrl);
});

// Step 2: Handle OAuth2 callback
app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  console.log('OAuth callback received, code:', code);

  try {
    const { tokens } = await oauth2Client.getToken(code);
    setTokens(tokens);

    // Store access token securely in a cookie
    res.cookie('authToken', tokens.access_token, {
      httpOnly: true, // Secure HTTP-only cookie
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
      maxAge: 3600 * 1000, // 1 hour
      sameSite: 'Strict', // Prevent CSRF
    });

    console.log('Access token stored in cookie.');

    res.send(`
      <script>
        window.opener.postMessage(
          { type: "auth-success", message: "Authentication successful!" },
          "${process.env.FRONTEND_URL}"
        );
        window.close();
      </script>
    `);
  } catch (error) {
    console.error('Error while getting tokens:', error);

    res.send(`
      <script>
        window.opener.postMessage(
          { type: "auth-error", message: "Failed to authenticate with Google." },
          "${process.env.FRONTEND_URL}"
        );
        window.close();
      </script>
    `);
  }
});

// Step 3: Fetch emails using Gmail API
app.get('/api/emails', async (req, res) => {
  const authToken = req.cookies.authToken; // Read token from cookies

  if (!authToken) {
    return res.status(400).json({ error: 'Authentication token is missing' });
  }

  try {
    oauth2Client.setCredentials({ access_token: authToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10,
    });

    if (!response.data.messages) {
      return res.json([]);
    }

    const emails = await Promise.all(
      response.data.messages.map(async (msg) => {
        const email = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
        });

        const headers = email.data.payload.headers;
        const sender = headers.find((header) => header.name === 'From')?.value || 'Unknown Sender';
        const time = new Date(parseInt(email.data.internalDate)).toLocaleString();
        const snippet = email.data.snippet || 'No preview available';

        return {
          id: email.data.id,
          sender,
          snippet,
          time,
        };
      })
    );

    res.json(emails);
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
