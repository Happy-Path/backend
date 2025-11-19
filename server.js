// server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');

dotenv.config();

// Routes
const authRoutes = require('./routes/authRoutes');
const emotionRoutes = require('./routes/emotion');
const sessionRoutes = require('./routes/sessions');
const reportRoutes = require('./routes/reports');
const lessonRoutes = require('./routes/lessonRoutes');
const progressRoutes = require('./routes/progress');
const teacherRoutes = require('./routes/teacher');
const quizRoutes = require('./routes/quizzes');
const adminRoutes = require('./routes/adminRoutes');   // keep if file exists
const userRoutes = require('./routes/userRoutes');     // keep if file exists
const messageRoutes = require('./routes/messageRoutes'); // keep if file exists
const parentRoutes = require('./routes/parentRoutes');
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();

// CORS
const allowedOrigins = [
    'http://localhost:8081',
    'http://localhost:5173',
    'http://localhost:8080',              // add if you sometimes serve frontend here
    process.env.FRONTEND_ORIGIN || undefined,
].filter(Boolean);

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));

// Parsers & logging
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// Optional request logger
app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`, {
        body: req.body,
        origin: req.get('origin'),
    });
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/emotion', emotionRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/admin', adminRoutes);     // remove if not using admin
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/parent', parentRoutes);
app.use("/api/notifications", notificationRoutes);


// 404
app.use((req, res) => {
    res.status(404).json({ message: 'Endpoint not found' });
});

// DB + server
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});
