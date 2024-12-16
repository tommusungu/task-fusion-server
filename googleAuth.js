const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const OAuth2Client = google.auth.OAuth2;

// Path to your Google client secret JSON
const credentialsPath = path.join(__dirname, 'client_secret.json');

// Load client secrets from the credentials.json file
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

// Create an OAuth2 client instance with credentials from client_secret.json
const oauth2Client = new OAuth2Client(
  credentials.web.client_id,
  credentials.web.client_secret,
  credentials.web.redirect_uris[0] // Redirect URI from client_secret.json
);

// Store tokens in the OAuth2 client
function setTokens(tokens) {
  oauth2Client.setCredentials(tokens);
}

module.exports = { oauth2Client, setTokens };
