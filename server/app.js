const express = require('express');
const cors = require('cors');
// ...other requires

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/requests', require('./routes/requestRoutes'));
app.use('/api/referrals', require('./routes/referralRoutes'));
app.use('/api/ngos', require('./routes/ngoRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/resources', require('./routes/resourceRoutes'));

module.exports = app;