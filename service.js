const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const axios = require('axios');
const helmet = require('helmet'); // For secure HTTP headers
const rateLimit = require('express-rate-limit'); // For rate limiting
const { body, validationResult } = require('express-validator'); // For input validation
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// MySQL Connection Pool with secure configuration
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10, // Limit number of connections
  waitForConnections: true,
  queueLimit: 0,
});

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000', // Restrict to your frontend domain
    methods: ['POST'], // Allow only POST
    credentials: false,
  })
);
app.use(express.json({ limit: '10kb' })); // Limit request body size
app.use(helmet()); // Add secure HTTP headers
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit to 100 requests per IP per window
    message: { message: 'Too many requests from this IP, please try again later.' },
  })
);

// POST endpoint for contact form with validation
app.post(
  '/api/contact',
  [
    // Input validation and sanitization
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters')
      .escape(),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email address'),
    body('message')
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Message must be between 10 and 1000 characters')
      .escape(),

  ],
  async (req, res) => {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { name, email, message } = req.body;

    try {
      // Save to MySQL (already secure with parameterized queries)
      const [result] = await db.execute(
        'INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)',
        [name, email, message]
      );

      // Send to Brevo with error handling
      const brevoApiKey = process.env.BREVO_KEY;
      if (!brevoApiKey) {
        throw new Error('Brevo API key is not configured');
      }
      const listId = 7; // Adjust to your Brevo list ID

      await axios.post(
        'https://api.brevo.com/v3/contacts',
        {
          email,
          attributes: {
            PRENOM: name,
          },
          listIds: [listId],
          updateEnabled: true,
        },
        {
          headers: {
            'api-key': brevoApiKey,
            'Content-Type': 'application/json',
          },
          timeout: 5000, // Add timeout to prevent hanging
        }
      );

      return res.status(200).json({
        message: 'Message sent successfully! We’ll get back to you soon.',
        contactId: result.insertId,
      });
    } catch (error) {
      console.error('Error processing request:', {
        message: error.message,
        stack: error.stack,
        ...(error.response ? { brevoResponse: error.response.data } : {}),
      });

      // Return generic error message to client (hide sensitive details)
      return res.status(500).json({
        message: 'An unexpected error occurred. Please try again later.',
      });
    }
  }
);

// Handle 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running securely on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing server');
  await db.end(); // Close MySQL connections
  process.exit(0);
});