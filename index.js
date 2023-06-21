const express = require('express');
const app = express();
const ejs = require('ejs');
const path = require('path');
const { readFileSync, writeFileSync } = require('fs');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));
app.use(express.static(path.join(process.cwd(), 'public/')))

app.use(function (req, res, next) {
    const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(ip, '>', req.url);
    next();
})

function render(file, options = {}) {
    return ejs.renderFile(path.join(app.settings.views, file + '.ejs'), options);
};

app.get('/', async function (req, res) {
    res.render('template', {
        title: 'Accueil',
        content: await render('home')
    })
});
app.get('/contact', async function (req, res) {
    res.render('template', {
        title: 'Contactes',
        content: await render('contact')
    });
});

app.get('/projects', async function (req, res) {
    res.render('template', {
        title: 'Projets',
        content: await render('projects', {
            bars: 20,
            projects: getprojects()
        })
    })
});

app.all('*', async function (req, res) {
    res.status(404).render('template', {
        title: '404',
        content: await render('404')
    })
});

app.listen(58270, function () {
    console.log('Server listenning.');

    setInterval(() => pingprojects(), 60 * 1000);
    pingprojects();
});


async function pingprojects() {
    var json = getprojects();
    for (var i = 0; i < json.length; i++) {
        if (json[i].pings && json[i].pings.length >= 0) {
            var dif = Math.floor((Date.now() - (json[i].date || 0)) / (60 * 60 * 1000));
            if (dif >= 1) {
                if (dif > 1)
                    json[i].pings.push(...('#'.repeat((dif > 25 ? 25 : dif) - 1).split('').map(() => -1)));
                var now = Date.now();
                var response = await fetch(json[i].url);
                if (response.status != 200)
                    json[i].pings.push(0);
                else json[i].pings.push(Date.now() - now);
                json[i].date = now;
            };
            json[i].pings = json[i].pings.slice(json[i].pings.length - 20, json[i].pings.length);
        }
    }
    saveprojects(json);
}


function getprojects() {
    return JSON.parse(readFileSync(path.join(process.cwd(), 'projects.json'), 'utf-8') || '[]');
}

function saveprojects(obj) {
    return writeFileSync(path.join(process.cwd(), 'projects.json'), JSON.stringify(obj), 'utf-8');
}