const express = require('express');
const app = express();
const port = 3000;
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const fs = require('fs');

var started_at = Date.now();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let guess = {};

io.on('connection', (socket) => {
    guess[socket.id] = { x: -1, y: -1, id: Object.keys(guess).length + 1 };
    socket.on('disconnect', () => {
        socket.broadcast.emit('left', { id: guess[socket.id].id });
        delete guess[socket.id];
    });
    socket.broadcast.emit('joined', { id: guess[socket.id].id });

    socket.on('cursor', (msg) => {
        if (typeof msg.x !== 'number' || typeof msg.y !== 'number') return;
        if (isNaN(msg.x) || isNaN(msg.y)) return;
        if (msg.x != -1 && msg.y != -1)
            if (msg.x < 0 || msg.x > 1 || msg.y < 0 || msg.y > 1) return;
        guess[socket.id].x = msg.x;
        guess[socket.id].y = msg.y;
        socket.broadcast.emit('cursor', { id: guess[socket.id].id, x: msg.x, y: msg.y });
    });

    socket.on('message', (msg) => {
        if (typeof msg.text !== 'string') return;
        if (msg.text.length > 256) return;
        io.emit('message', {
            text: msg.text,
            id: guess[socket.id].id
        });
    });
});

app.use(express.static('public'));

var hss = JSON.parse(fs.readFileSync('hss.json', 'utf-8'));
app.get('/well-known/hss.json', (req, res) => {
    res.json({
        ...hss,
        started_at: started_at
    });
});

app.get('/api/services.json', (req, res) => {
    res.send(formatedServices());
});

function getJSONServices() {
    return JSON.parse(fs.readFileSync('services.json', 'utf-8'));
}

function saveJSONServices(data) {
    fs.writeFileSync('services.json', JSON.stringify(data, null, 4));
}

const delayVerif = 60 * 60 * 1000;
var services = getJSONServices();
function formatedServices() {
    return {
        started_at: services.started_at,
        services: services.services.map(service => ({
            url: service.url,
            data: service.data,
            hearts: service.hearts.map(heart => ({
                response: heart.response,
                started_at: heart.started_at,
                ended_at: heart.ended_at
            }))
        }))
    };
}


void (async () => {
    await sleep(1000);
    services.started_at = Date.now();
    saveJSONServices(services);
    var  init = true;
    while (true) {
        for (let i = 0; i < services.services.length; i++) {
            let service = services.services[i];
            if (!service.url) continue;
            if (!service.hearts) service.hearts = [];
            if (!service.data) service.data = {};
            var lastHeart = service.hearts.sort((a, b) => b.ended_at - a.ended_at)[0];
            if (lastHeart && !init) {
                var d = new Date();
                var l = new Date(lastHeart.ended_at);
                if(d.getHours() == l.getHours() && d.getDate() == l.getDate() && d.getMonth() == l.getMonth() && d.getFullYear() == l.getFullYear())
                    continue;
            }
            console.log(`Checking service ${service.url}`);
            let heart = {
                response: 0,
                started_at: Date.now(),
                ended_at: 0
            };
            try {
                let res = await fetch(service.url);
                heart.response = res.status;
                service.data = await res.json();
            } catch (e) {
                heart.response = 0;
            }
            heart.ended_at = Date.now();
            service.hearts.push(heart);
            service.hearts = service.hearts.filter(heart => heart.ended_at > Date.now() - 48 * 60 * 60 * 1000);

            services.services[i] = service;
            saveJSONServices(services);
            io.emit('services', formatedServices(services));
        }
        init = false;
        await sleep(10000);
    }
})();
server.listen(port, () => {
    started_at = Date.now();
    console.log(`Server is running on port ${port}`);
});