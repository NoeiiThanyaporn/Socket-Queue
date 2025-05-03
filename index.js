const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    connectionStateRecovery: {}
});

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

const ipConnections = {};

io.on('connection', (socket) => {
    const ip = socket.handshake.address;
    ipConnections[ip] = (ipConnections[ip] || 0) + 1;

    console.log('a user connected');

    // // send msg to frontend when some user disconnect
    // socket.on('disconnect', () => {
    //     console.log('user disconnected');
    //     io.to('some room').emit('chat message', '*disconnect*'); 
    // });
    socket.on('disconnect', () => {
        ipConnections[ip] -= 1;
        if (ipConnections[ip] === 0) {
            delete ipConnections[ip];
        }
        // console.log(`Disconnected: ${ip}. Remaining: ${ipConnections[ip] || 0}`);
        console.log(`Remaining: ${ipConnections[ip] || 0}`);
    });

    // send msg to frontend
    socket.on('chat message', (msg) => {
        io.emit('chat message', msg); 
    });

    console.log(`New connection from ${ip}. Total: ${ipConnections[ip]}`);

    // Disconnect if too many connections from the same IP
    if (ipConnections[ip] > 3) {
        socket.emit('chat message', 'Too many connections from your IP');
        socket.disconnect(true);
        return;
    }

    // **For show msg when new user access** //
    // join the room named 'some room'
    socket.join('some room');

    // broadcast to all connected clients in the room
    io.to('some room').emit('chat message', 'Welcome to join room');

    // broadcast to all connected clients except those in the room
    io.except('some room').emit('chat message', `user number: ${ipConnections[ip]} in caht`);

    // leave the room
    socket.leave('some room')
});

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});