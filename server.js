require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth');
const reportRoutes = require("./routes/report");
const app = express();
const path = require('path');

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
  }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use("/api/report", reportRoutes);
app.use(express.static('public'));

// Opens the login page when going to the main URL
app.get('/', (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "LoginUI", "Main.html")
    );
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, (err) => {
  if (err) {
    console.error('Server failed to start:', err.message);
    process.exit(1);
  }
  console.log(`Server listening on http://localhost:${PORT}`);
});