const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');
const rooms = require('./EXAMPLE_DATA/room.json')


const app = express();
const server = createServer(app);
const io = new Server(server, {
    connectionStateRecovery: {}
});

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

app.get('/rooms', (req, res) => {
    res.json(rooms)
})


app.get('/rooms/:id', (req, res) => {
    res.json(rooms.find(room => room.id === req.params.id))
})

const MAX_ACTIVE_USERS = 5;
const activeUsers = new Set(); // Connected and allowed
const waitingQueue = []; // Queued sockets


io.on('connection', (socket) => {
    console.log(`User ${socket.id} connected`);

    // Handle queue admission
    function inUsing(socketToUsing) {
        activeUsers.add(socketToUsing.id);
        socketToUsing.emit('in_using', { number: activeUsers.size });
        io.emit('update_status', {
            active: Array.from(activeUsers),
            queue: waitingQueue.map(s => s.id)
        });
    }

    // Handle queue admission
    function inQueue(socketToQueue) {
        waitingQueue.push(socketToQueue);
        socketToQueue.emit('in_queue', { number: waitingQueue.length });
        io.emit('update_status', {
            active: Array.from(activeUsers),
            queue: waitingQueue.map(s => s.id),
        });
    }

    if (activeUsers.size < MAX_ACTIVE_USERS) { // less than Max_accessing
        inUsing(socket);
    } else {
        inQueue(socket)
    }

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`User ${socket.id} disconnected`);

        activeUsers.delete(socket.id);

        // Remove from waiting queue (if they disconnected before entry)
        const index = waitingQueue.findIndex(s => s.id === socket.id);
        if (index !== -1) waitingQueue.splice(index, 1);

        // Promote next user in queue
        if (waitingQueue.length > 0 && activeUsers.size < MAX_ACTIVE_USERS) {
            const nextSocket = waitingQueue.shift();
            inUsing(nextSocket);
        }

        io.emit('update_status', {
            active: Array.from(activeUsers),
            queue: waitingQueue.map(s => s.id)
        });
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
