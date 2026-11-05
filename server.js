require('dotenv').config();
// Prisma's binary engine detects readiness from its INFO startup message.
// A parent process's RUST_LOG=warn suppresses that message and hangs queries.
process.env.RUST_LOG = 'info';
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');

const app = express();
const studentRoutes = require("./routes/student");
const mycapsRoutes = require("./routes/mycaps");
const adminRoutes = require("./routes/admin");

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
  }));
app.use(express.json());
app.use(cookieParser());
app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ status: 'running', auditPresentationVersion: 2 });
});

// Disable public account registration
app.post('/api/auth/register', (req, res) => {
    return res.status(403).json({
        error: 'Public registration is disabled.'
    });
});
app.use('/api/auth', authRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/mycaps", mycapsRoutes);
app.use("/api/admin", adminRoutes);
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.redirect('/LoginUI/Main.html');
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, (err) => {
  if (err) {
    console.error('Server failed to start:', err.message);
    process.exit(1);
  }
  console.log(`Server listening on http://localhost:${PORT}`);
});
