// Chat Server for Holy Army Fellowship
// This file would be deployed to a separate Node.js server environment
// For example: Render, Heroku, or any other Node.js hosting service

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // In production, restrict to your domain
    methods: ["GET", "POST"]
  }
});

// Store connected users
const connectedUsers = new Map();
let adminConnected = false;

// Root route
app.get('/', (req, res) => {
  res.send('Holy Army Fellowship Chat Server is running');
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Register user or admin
  socket.on('register', (data) => {
    const { userId, userName, userType } = data;
    
    if (userType === 'admin') {
      adminConnected = true;
      socket.join('admin');
      console.log('Admin connected');
      
      // Broadcast admin status to all users
      io.emit('admin_status', { online: true });
      
    } else {
      // Regular user
      connectedUsers.set(userId, {
        socketId: socket.id,
        userName,
        online: true
      });
      
      socket.join(userId);
      console.log(`User connected: ${userName} (${userId})`);
      
      // Send admin status to the user
      socket.emit('admin_status', { online: adminConnected });
    }
  });
  
  // Handle user typing
  socket.on('user_typing', (data) => {
    if (adminConnected) {
      io.to('admin').emit('user_typing', data);
    }
  });
  
  // Handle admin typing
  socket.on('admin_typing', (data) => {
    const { userId } = data;
    const user = connectedUsers.get(userId);
    
    if (user) {
      io.to(userId).emit('admin_typing');
    }
  });
  
  // Handle messages from users
  socket.on('message', (data) => {
    const { messageId, userId, text, attachment, timestamp } = data;
    
    // Mark as delivered immediately
    socket.emit('message_delivered', messageId);
    
    // Forward to admin if connected
    if (adminConnected) {
      io.to('admin').emit('message', {
        messageId,
        userId,
        text,
        attachment,
        timestamp
      });
    }
  });
  
  // Handle messages from admin
  socket.on('admin_message', (data) => {
    const { messageId, userId, text, attachment, timestamp } = data;
    const user = connectedUsers.get(userId);
    
    if (user) {
      // Send to specific user
      io.to(userId).emit('message', {
        messageId,
        text,
        attachment,
        timestamp
      });
      
      // Mark as delivered
      io.to('admin').emit('message_delivered', messageId);
    }
  });
  
  // Handle message delivery confirmation
  socket.on('message_delivered', (data) => {
    const { messageId, userId } = data;
    
    if (adminConnected) {
      io.to('admin').emit('message_delivered', messageId);
    } else {
      const user = connectedUsers.get(userId);
      if (user) {
        io.to(userId).emit('message_delivered', messageId);
      }
    }
  });
  
  // Handle message read confirmation
  socket.on('message_read', (data) => {
    const { messageId, userId } = data;
    
    if (socket.rooms.has('admin')) {
      // Admin read a user message
      io.to(userId).emit('message_read', messageId);
    } else {
      // User read an admin message
      io.to('admin').emit('message_read', messageId);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Check if it was the admin
    if (socket.rooms.has('admin')) {
      adminConnected = false;
      io.emit('admin_status', { online: false });
      console.log('Admin disconnected');
      return;
    }
    
    // Check if it was a user
    for (const [userId, user] of connectedUsers.entries()) {
      if (user.socketId === socket.id) {
        connectedUsers.delete(userId);
        console.log(`User disconnected: ${user.userName} (${userId})`);
        break;
      }
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});