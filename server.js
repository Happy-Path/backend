const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const authRoutes = require('./routes/authRoutes');
const emotionRoutes = require('./routes/emotion');
const sessionRoutes = require('./routes/sessions');
const reportRoutes = require('./routes/reports');
const cors = require('cors');
// Load environment variables
dotenv.config();



// Initialize the app
const app = express();

// CORS
app.use(cors({
  origin: 'http://localhost:8081',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(bodyParser.json());

// Logging middleware (keep for debugging)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    body: req.body,
    headers: req.headers,
    origin: req.get('origin')
  });
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/emotion', emotionRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/reports', reportRoutes);


// Optional fallback route for unknown endpoints
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.log(err));

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
