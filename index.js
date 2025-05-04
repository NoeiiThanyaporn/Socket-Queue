const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const PORT = 3000
const rooms = require('./EXAMPLE_DATA/room.json')
const listRooms = {
    "1": {
        activeUsers: new Set(),
        waitingQueue: [],
    },
    "2": {
        activeUsers: new Set(),
        waitingQueue: [],
    }
};

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

io.on('connection', (socket) => {
    // Handle queue admission
    function handleInActive(roomState, socketToUsing) {
        roomState.activeUsers.add(socketToUsing.id);
        socketToUsing.emit('in_active', { number: roomState.activeUsers.size });
    }

    // Handle queue admission
    function handleInQueue(roomState, socketToQueue) {
        roomState.waitingQueue.push(socketToQueue);
        socketToQueue.emit('in_queue', { number: roomState.waitingQueue.length });
    }

    socket.on('select_room', ({ room }) => {
        socket.data.room = room;
        const roomState = listRooms[room];
        if (!roomState) return;

        if (roomState.activeUsers.size < MAX_ACTIVE_USERS) {
            handleInActive(roomState, socket)
        } else {
            handleInQueue(roomState, socket)
        }

        io.emit('update_status', {
            room: room,
            active: Array.from(roomState.activeUsers),
            queue: roomState.waitingQueue.map(s => s.id)
        });
    });

    socket.on('disconnect', () => {
        const room = socket.data.room;

        if (!room || !listRooms[room]) return;

        const roomState = listRooms[room];

        roomState.activeUsers.delete(socket.id);
        const index = roomState.waitingQueue.findIndex(s => s.id === socket.id);
        if (index !== -1) roomState.waitingQueue.splice(index, 1);

        // Promote next in queue
        if (roomState.waitingQueue.length > 0 && roomState.activeUsers.size < MAX_ACTIVE_USERS) {
            const nextSocket = roomState.waitingQueue.shift();
            roomState.activeUsers.add(nextSocket.id);
            nextSocket.emit('in_active', { number: roomState.activeUsers.size });
        }

        io.emit('update_status', {
            room: room,
            active: Array.from(roomState.activeUsers),
            queue: roomState.waitingQueue.map(s => s.id)
        });
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
