require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const initChat = require('./socket/chat');

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  const server = http.createServer(app);
  initChat(server);
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});