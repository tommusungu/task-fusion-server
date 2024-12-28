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
  origin: ["http://localhost:8080"], 
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
      secure: true, // Use secure cookies in production
      maxAge: 3600 * 1000, // 1 hour
      sameSite: 'None', // Prevent CSRF
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


app.get('/api/tokens', (req, res) => {
  const token = req.cookies.authToken;
  console.log('api tokens:',token)
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. No token found in cookies.' });
  }

  res.json({ access_token: token });
});

// step 3

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
      maxResults: 20,
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
        const subject = headers.find((header) => header.name === 'Subject')?.value || 'No Subject';
        const date = new Date(parseInt(email.data.internalDate)).toLocaleString();
        const read = email.data.labelIds.includes('UNREAD') ? false : true; // Assume email is read if it does not have the "UNREAD" label
        const provider = 'gmail'; // Since you're using Gmail API

        // Extract the body content
        let body = 'No body available';
        const parts = email.data.payload.parts || [email.data.payload];

        for (const part of parts) {
          if (part.mimeType === 'text/html') {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            break; // Use the first HTML part found
          } else if (part.mimeType === 'text/plain') {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
          }
        }

        return {
          id: email.data.id,
          from: sender,
          to: 'me', // Gmail doesn't provide a direct "to" field in the response, so this can be static or extracted if needed
          subject,
          body,
          date,
          read,
          provider,
        };
      })
    );

    res.json(emails);
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});



// Step 4: Fetch a single email by ID
app.get('/api/emails/:emailId', async (req, res) => {
  const { emailId } = req.params;
  const authToken = req.cookies.authToken; // Read token from cookies

  if (!authToken) {
    return res.status(400).json({ error: 'Authentication token is missing' });
  }

  try {
    oauth2Client.setCredentials({ access_token: authToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const email = await gmail.users.messages.get({
      userId: 'me',
      id: emailId,
    });

    const headers = email.data.payload.headers;
    const sender = headers.find((header) => header.name === 'From')?.value || 'Unknown Sender';
    const time = new Date(parseInt(email.data.internalDate)).toLocaleString();
    const message = email.data.snippet || 'No preview available';

    res.json({
      id: email.data.id,
      sender,
      message,
      time,
      avatar: null, // Add logic to retrieve sender's avatar if available
      unread: false, // Update based on message status if needed
    });
  } catch (error) {
    console.error('Error fetching email:', error);
    res.status(500).json({ error: 'Failed to fetch email' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
