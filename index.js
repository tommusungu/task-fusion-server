// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const bodyParser = require('body-parser');
// const { StreamChat } = require('stream-chat');

// const app = express();
// app.use(cors());
// app.use(bodyParser.json());

// const API_KEY = process.env.STREAM_API_KEY;
// const API_SECRET = process.env.STREAM_API_SECRET;

// // Initialize StreamChat server client
// const serverClient = StreamChat.getInstance(API_KEY, API_SECRET);

// // Generate user token
// app.post('/getToken', async (req, res) => {
//     const { userId } = req.body;

//     if (!userId) {
//         return res.status(400).json({ error: 'User ID is required' });
//     }

//     try {
//         const token = serverClient.createToken(userId);
//         return res.json({ token });
//     } catch (error) {
//         console.error('Error generating token:', error);
//         return res.status(500).json({ error: 'Internal server error' });
//     }
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}`);
// });




require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { StreamChat } = require('stream-chat');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const API_KEY = process.env.STREAM_API_KEY;
const API_SECRET = process.env.STREAM_API_SECRET;

// Initialize StreamChat server client
const serverClient = StreamChat.getInstance(API_KEY, API_SECRET);

// Generate user token (chat & video)
app.post('/getToken', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        const chatToken = serverClient.createToken(userId); // Chat token
        const videoToken = serverClient.createToken(userId); // Video token

        return res.json({ chatToken, videoToken });
    } catch (error) {
        console.error('Error generating token:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
