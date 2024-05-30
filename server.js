const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const sanitizeHtml = require('sanitize-html');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

const colors = ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#FF33A8', '#FF8A33', '#33FFF5', '#8A33FF'];
let users = {};
let messages = [];

// Función para escapar y sanitizar contenido HTML
function escapeHtml(unsafe) {
    return sanitizeHtml(unsafe, {
        allowedTags: [],
        allowedAttributes: {}
    });
}

// Manejo de conexiones socket.io
io.on('connection', (socket) => {
    console.log('Nuevo usuario conectado');

    // Enviar mensajes antiguos al nuevo usuario
    socket.emit('previous messages', messages);

    socket.on('new user', (username) => {
        if (!users[socket.id]) {
            const sanitizedUsername = escapeHtml(username);
            users[socket.id] = {
                username: sanitizedUsername,
                color: colors[Object.keys(users).length % colors.length]
            };
            io.emit('user joined', users[socket.id]);
        }
    });

    socket.on('chat message', (msg) => {
        const user = users[socket.id];
        if (user) {
            const messageData = { 
                id: messages.length,
                username: user.username, 
                color: user.color, 
                message: escapeHtml(msg),
                timestamp: Date.now(),
                reactions: {}
            };
            messages.push(messageData);

            if (messages.length > 100) {
                messages.shift();
            }

            io.emit('chat message', messageData);
        }
    });

    socket.on('reaction', (reactionData) => {
        const user = users[socket.id];
        if (user && messages[reactionData.messageId]) {
            const message = messages[reactionData.messageId];
            if (!message.reactions[reactionData.reaction]) {
                message.reactions[reactionData.reaction] = 0;
            }
            message.reactions[reactionData.reaction] += 1;
            io.emit('reaction', { 
                messageId: reactionData.messageId,
                reaction: reactionData.reaction
            });
        }
    });

    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            io.emit('user left', user);
            delete users[socket.id];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});

