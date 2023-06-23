const express = require('express');
const sitemap = require('express-sitemap');
const app = express();
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');
const { readFileSync, writeFileSync } = require('fs');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));
app.use(express.static(path.join(process.cwd(), 'public/')))

const STORAGE_DIR = process.env.STORAGE_DIR || process.cwd();
const config = require(path.join(STORAGE_DIR, 'config.json'));

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
        title: config.titles['home'],
        author: config.author,
        globaltitle: config.title,
        canonical: config.defaultOrigin + req.url.split('?')[0],
        description: config.descriptions['home'] || '',
        keywords: config.descriptions['home'] || '',
        content: await render('home')
    })
});
app.get('/contact', async function (req, res) {
    res.render('template', {
        title: config.titles['contact'],
        author: config.author,
        globaltitle: config.title,
        canonical: config.defaultOrigin + req.url.split('?')[0],
        description: config.descriptions['contact'] || '',
        keywords: config.descriptions['contact'] || '',
        content: await render('contact')
    });
});

app.get('/about', async function (req, res) {
    res.render('template', {
        title: config.titles['about'],
        author: config.author,
        globaltitle: config.title,
        canonical: config.defaultOrigin + req.url.split('?')[0],
        description: config.descriptions['about'] || '',
        keywords: config.descriptions['about'] || '',
        content: await render('about')
    });
});


app.get('/projects', async function (req, res) {
    res.render('template', {
        title: config.titles['projects'],
        author: config.author,
        globaltitle: config.title,
        canonical: config.defaultOrigin + req.url.split('?')[0],
        description: config.descriptions['projects'] || '',
        keywords: config.descriptions['projects'] || '',
        content: await render('projects', {
            bars: 20,
            projects: getprojects()
        })
    })
});

app.get('/commissions', async function (req, res) {
    const { openned = false, types = [] } = JSON.parse(readFileSync(path.join(STORAGE_DIR, 'commissions.json'), 'utf-8') || '{}');
    res.render('template', {
        author: config.author,
        globaltitle: config.title,
        canonical: config.defaultOrigin + req.url.split('?')[0],
        description: config.descriptions['commissions'] || '',
        keywords: config.descriptions['commissions'] || '',
        title: config.titles['commissions'] || '',
        content: await render('commissions', { openned, types })
    })
});

var sm;

app.get('/robots.txt', function (req, res) {
    sm.TXTtoWeb(res)
});

app.get('/sitemap.xml', function (req, res) {
    sm.XMLtoWeb(res)
});

app.all('*', async function (req, res) {
    res.status(404).render('template', {
        author: config.author,
        globaltitle: config.title,
        canonical: config.defaultOrigin + req.url.split('?')[0],
        description: config.descriptions['404'] || '',
        keywords: config.descriptions['404'] || '',
        title: config.titles['404'] || '',
        content: await render('404')
    })
});

app.listen(58270, function () {
    console.log('Server listenning.');

    setInterval(() => pingprojects(), 60 * 1000);
    pingprojects();
});


async function pingprojects() {
    sm = sitemap({
        route: {
            '/': {
                lastmod: fs.statSync(path.join(process.cwd(), 'views', 'home.ejs')).mtime.toISOString().split('T')[0],
                priority: 1,
            },
            '/commissions': {
                lastmod: fs.statSync(path.join(STORAGE_DIR, 'commissions.json')).mtime.toISOString().split('T')[0],
                priority: .8,
            },
            '/projects': {
                lastmod: new Date(getprojects().map(e => e.date || 0).sort((a, b) => b - a)[0]).toISOString().split('T')[0],
                changefreq: 'hourly',
                priority: .8,
            },
            '*': {
                hide: true
            }

        }
    })
    sm.generate(app);
    var json = getprojects();
    for (var i = 0; i < json.length; i++) {

        if (json[i].pings && json[i].pings.length >= 0) {
            var dif = Math.floor((Date.now() - (json[i].date || 0)) / (60 * 60 * 1000));
            if (dif >= 1) {
                if (dif > 1)
                    json[i].pings.push(...('#'.repeat((dif > 25 ? 25 : dif) - 1).split('').map(() => -1)));
                var now = Date.now();
                try {
                    var response = await fetch(json[i].url);
                    if (response.status != 200)
                        json[i].pings.push(0);
                    else json[i].pings.push(Date.now() - now);
                } catch {
                    json[i].pings.push(0);
                };
                json[i].date = now;
            };
            json[i].pings = json[i].pings.slice(json[i].pings.length - 20, json[i].pings.length);
        }
    }
    saveprojects(json);
}


function getprojects() {
    return JSON.parse(readFileSync(path.join(STORAGE_DIR, 'projectstats.json'), 'utf-8') || '[]');
}

function saveprojects(obj) {
    return writeFileSync(path.join(STORAGE_DIR, 'projectstats.json'), JSON.stringify(obj), 'utf-8');
}