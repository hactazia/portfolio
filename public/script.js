window.addEventListener('load', function () {
    const sections = document.querySelectorAll('.section');
    const background_social = document.querySelector('#background-socials');

    let index_before = 0;
    window.addEventListener("wheel", function (e) {
        if (e.target.closest('.scrollable')) return;
        let index = 0;
        sections.forEach((section, i) => {
            const rect = section.getBoundingClientRect();
            if (rect.top <= window.innerHeight / 2 && rect.bottom >= window.innerHeight / 2)
                index = i;
        });

        if (e.deltaY > 0)
            index++;
        else index--;
        if (index < 0)
            index = 0;
        else if (index > sections.length - 1)
            index = sections.length - 1;
        if (index_before !== index)
            gotoSection(index);
        index_before = index;
    }, false);

    // mouvetouch to scroll
    let startY = 0;
    let endY = 0;
    window.addEventListener('touchstart', function (e) {
        startY = e.touches[0].clientY;
    });

    window.addEventListener('touchend', function (e) {
        endY = e.changedTouches[0].clientY;
        if (Math.abs(startY - endY) < 50) return;
        let index = 0;
        sections.forEach((section, i) => {
            const rect = section.getBoundingClientRect();
            if (rect.top <= window.innerHeight / 2 && rect.bottom >= window.innerHeight / 2)
                index = i;
        });
        if (startY > endY)
            index++;
        else index--;
        if (index < 0)
            index = 0;
        else if (index > sections.length - 1)
            index = sections.length - 1;
        if (index_before !== index)
            gotoSection(index);
        index_before = index;
    });


    // array down key
    window.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') {
            let index = 0;
            sections.forEach((section, i) => {
                const rect = section.getBoundingClientRect();
                if (rect.top <= window.innerHeight / 2 && rect.bottom >= window.innerHeight / 2)
                    index = i;
            });
            index++;
            if (index < sections.length)
                gotoSection(index);
        } else if (e.key === 'ArrowUp') {
            let index = 0;
            sections.forEach((section, i) => {
                const rect = section.getBoundingClientRect();
                if (rect.top <= window.innerHeight / 2 && rect.bottom >= window.innerHeight / 2)
                    index = i;
            });
            index--;
            if (index >= 0)
                gotoSection(index);
        }
    });

    function gotoSection(index) {
        sections.forEach((section) => section.classList.remove('active'));
        sections[index].classList.add('active');
        window.scrollTo({
            top: sections[index].offsetTop,
            left: 0,
            behavior: 'smooth'
        });
    }

    // on click on a #hash link, go to the section
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const section = document.querySelector(this.getAttribute('href'));
            const index = Array.from(sections).indexOf(section);
            gotoSection(index);
        });
    });

    var socket = io();
    var guess = {};

    socket.on('connect', function () {
        guess = {};
    });

    socket.on('disconnect', function () {
        guess = {};
    });

    socket.on('joined', function (msg) {
    });

    socket.on('left', function (msg) {
        document.getElementById('cursor-' + msg.id)?.remove();
        delete guess[msg.id];
    });

    window.addEventListener('mousemove', mv);
    function mv(e) {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        socket.emit('cursor', { x: x, y: y });
        var dis = Math.sqrt((x - guess[0]?.px) ** 2 + (y - guess[0]?.py) ** 2);

        guess[0] = {
            x: x,
            y: y,
            px: guess[0]?.x === -1 ? x : guess[0]?.x || x,
            py: guess[0]?.y === -1 ? y : guess[0]?.y || y,
            t: Date.now(),
            id: 0
        };
    }

    window.addEventListener('mouseout', function () {
        socket.emit('cursor', { x: -1, y: -1 });
        guess[0] = {
            x: -1,
            y: -1,
            px: guess[0]?.x || -1,
            py: guess[0]?.y || -1,
            t: Date.now(),
            id: 0
        };
    });


    socket.on('cursor', function (msg) {
        if (inblur) return;
        if (guess[msg.id]) {
            guess[msg.id] = {
                px: guess[msg.id].x === -1 ? msg.x : guess[msg.id].x,
                py: guess[msg.id].y === -1 ? msg.y : guess[msg.id].y,
                x: msg.x,
                t: Date.now(),
                y: msg.y,
            };
        } else {
            guess[msg.id] = {
                px: msg.x,
                py: msg.y,
                x: msg.x,
                t: Date.now(),
                y: msg.y,
            };
        }
    });

    socket.on('message', function (msg) {
        if (inblur) return;
        const message = document.createElement('div');
        var size = msg.text.length / 64 * 2 + 1;
        message.style.fontSize = size + 'em';
        message.style.opacity = (128 - msg.text.length) / 128 - .5;
        message.textContent = msg.text;
        message.classList.add('message');
        message.style.left = Math.random() * 100 + '%';
        message.style.top = Math.random() * 100 + '%';
        background_social.appendChild(message);
        setTimeout(() => message.remove(), 10000);
    });

    let inblur = false;
    window.addEventListener('blur', function () {
        socket.emit('cursor', { x: -1, y: -1 });
        inblur = true;
    });
    window.addEventListener('focus', function () {
        inblur = false;
    });

    const run = function () {
        requestAnimationFrame(run);
        if (inblur) return;
        for (var id in guess) {
            var cursor = document.getElementById('cursor-' + id);
            if (guess[id].x === -1 && guess[id].y === -1 && cursor || Date.now() - guess[id].t > 100) {
                cursor.remove();
                delete guess[id];
                continue;
            }
            if (!cursor) {
                cursor = document.createElement('div');
                cursor.id = 'cursor-' + id;
                cursor.className = 'cursor';
                background_social.appendChild(cursor);
            }
            cursor.style.left = (guess[id].x * 100) + '%';
            cursor.style.top = (guess[id].y * 100) + '%';
            var dis = Math.sqrt((guess[id].x - guess[id].px) ** 2 + (guess[id].y - guess[id].py) ** 2);
            cursor.style.opacity = Math.min(dis * 4, 1);
            cursor.style.width = (1 + dis * 10) * 4 + 'em';
            cursor.style.height = (1 + dis * 10) * 4 + 'em';
        }
    };

    run();

    /**
     * @type {NodeListOf<HTMLDivElement>}
     */
    const cards = document.querySelectorAll('.card');
    cards.forEach(cardfunc);
    function cardfunc(card) {
        card.addEventListener('mousemove', (e) => {
            let elRect = card.getBoundingClientRect();
            let x = e.clientX - elRect.x
            let y = e.clientY - elRect.y

            let midcardwidth = elRect.width / 2;
            let midcardheight = elRect.height / 2;

            let ax = -(x - midcardwidth) / Math.sqrt(midcardheight ** 2 + midcardwidth ** 2) * 2;
            let ay = (y - midcardheight) / Math.sqrt(midcardheight ** 2 + midcardwidth ** 2) * 2;

            let glowx = x / elRect.width * 100;
            let glowy = y / elRect.height * 100;

            Array.from(card.children).forEach((child) => {
                child.style.transform = `rotateY(${ax}deg) rotateX(${ay}deg) scale(1.01)`;
                if (child.classList.contains('glow'))
                    child.style.background = `radial-gradient(circle at ${glowx}% ${glowy}%, #ffffff0a 0%, #0000 70%)`
            });
        });

        card.addEventListener('mouseleave', (e) => {
            Array.from(card.children).forEach((child) => {
                child.style.transform = `rotateY(0deg) rotateX(0deg) scale(1)`;
                if (child.classList.contains('glow'))
                    child.style.background = `radial-gradient(circle at 0% 0%, #0000 0%, #0000 70%)`
            });
        });
    }

    const node_services = document.querySelector('#services-body');

    socket.on('services', msg => services(msg));
    services();

    function services(data) {
        if (data) {
            let html = '';
            for (let service of data.services) {
                if (!service.data || !service.data.title) continue;

                // "hearts": [
                //     {
                //         "response": 200,
                //         "started_at": 1712263458844,
                //         "ended_at": 1712263458885
                //     }
                // ]
                var current = new Date();
                var hearts = [];

                // for each hour (on 24)
                for (var i = Date.now(), j = 0; j < 24; i -= 3600000, j++) {
                    var di = new Date(i);
                    var heart = service.hearts.find(heart => {
                        var ds = new Date(heart.started_at);
                        return di.getHours() === ds.getHours() && di.getDate() === ds.getDate() && di.getMonth() === ds.getMonth() && di.getFullYear() === ds.getFullYear();
                    });
                    if (heart) {
                        hearts.push({
                            response: heart.response,
                            at: di,
                            ping: heart.ended_at - heart.started_at
                        });
                    } else {
                        hearts.push({
                            response: 0,
                            at: di,
                            ping: -1
                        });
                    }
                }

                if (hearts.filter(heart => heart.response === 0).length === 24) hearts = [];


                html += `
                <div class="card">
                  <div class="card-content" style="background: ${service.data.background || '#fff'}; color: ${service.data.color || '#000'}">
                    <div class="card-title">
                        <h1>${service.data.title}</h2>
                    </div>
                    <div class="card-description">
                        <p>${service.data.description}</p>
                    </div>
                    ${hearts.length ? `
                    <div class="card-hearts">
                        <ul>
                            ${hearts.reverse().map(heart => `
                            <li style="background: var(${(() => {
                        if (heart.response === 200) {
                            if (heart.ping < 0)
                                return '--heart-unknown';
                            else if (heart.ping < 100)
                                return '--heart-fast';
                            else if (heart.ping < 200)
                                return '--heart-medium';
                            else return '--heart-slow';
                        } else if (heart.response === 0)
                            return '--heart-unknown';
                        else return '--heart-error';
                    })()});"></li>
                            `).join('')}
                        </ul>
                    </div>
                    ` : ''}
                    ${service.data.link ? `
                    <div class="card-footer">
                        <a href="${service.data.link}" target="_blank" rel="noopener noreferrer">Read more <i class="bi bi-arrow-right"></i></a>
                    </div>
                    ` : ''}
                  </div>
                  <div class="glow"></div>
                </div>
                `;
            }
            node_services.innerHTML = html;
            node_services.querySelectorAll('.card').forEach(cardfunc);
        } else {
            node_services.innerHTML = `Fetching services...`;
            try {

                fetch('/api/services.json')
                    .then(res => {
                        if (!res.ok)
                            throw new Error('Error fetching services...');
                        return res;
                    })
                    .then(res => res.json())
                    .then(data => services(data));
            } catch (e) {
                node_services.innerHTML = `Error fetching services...`;
            }
        }
    }

});