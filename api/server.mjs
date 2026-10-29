/**
 * Minimal, dependency-free reference API for the portfolio.
 *
 * It exists so `docker compose up` gives a working full stack out of the box.
 * Swap it for your real backend (Nest, Fastify, Go, Rust, ...) as long as it
 * answers under `/api/*` and allows the site origin via CORS when the two are
 * served from different domains (e.g. GitHub Pages + a separate API host).
 *
 * Endpoints
 *   GET  /api/health   -> liveness probe
 *   GET  /api/projects -> project list consumed by the landing page
 *   GET  /api/showcase -> tilted card scrapbook cards
 *   GET  /api/contacts -> contact rows of the "04 — Contact" section
 *   GET  /api/stack    -> grouped tooling, used by the band and by `/stack`
 *   GET  /api/site     -> brand, copy and logo geometry of the design page
 *   GET  /api/about    -> figures and timeline of the "03 — About" section
 *   GET  /api/assets/* -> logos and showcase images, streamed from disk
 *   POST /api/contact  -> contact form
 *
 * The content of every endpoint is read from `content.json` (gitignored), with
 * `content.example.json` as the committed fallback — see `loadContent()`.
 */
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT ?? 3001);
const STARTED_AT = Date.now();
const CONTACT_TO = process.env.CONTACT_TO ?? "contact@example.com";

const allowedOrigins = (process.env.API_ALLOWED_ORIGINS ?? "*")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

/* -------------------------------------------------------------------------- */
/* Content — read from disk, never inlined                                    */
/* -------------------------------------------------------------------------- */

/**
 * Everything the API states lives in a JSON file, so the deployment can be
 * re-pointed without touching code:
 *
 *   CONTENT_FILE            explicit path (compose mounts the host file here),
 *   ./content.json          the real content — gitignored,
 *   ./content.example.json  the committed sample, used when the above is absent.
 *
 * JSON rather than YAML on purpose: no dependency to install, and the file is
 * still diffable. Every key is required — an incomplete file is rejected at
 * boot instead of serving a half-empty page.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const CONTENT_KEYS = ["projects", "showcaseCards", "contactRows", "stackGroups", "site", "about"];

function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertContent(content, file) {
    const missing = CONTENT_KEYS.filter((key) => {
        const value = content[key];
        // The two objects must exist; the four lists must also hold something,
        // otherwise the client renders a section with nothing in it.
        if (key === "site" || key === "about") return !isObject(value);
        return !Array.isArray(value) || value.length === 0;
    });

    if (missing.length) throw new Error(`${file}: missing or empty ${missing.join(", ")}`);
}

function resolveContentFile() {
    const candidates = [
        process.env.CONTENT_FILE,
        join(HERE, "content.json"),
        join(HERE, "content.example.json"),
    ].filter(Boolean);

    for (const candidate of candidates) {
        // A bind-mounted file that does not exist on the host yet surfaces as a
        // directory, so existsSync alone is not enough.
        if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }

    throw new Error(
        `No content file found (tried ${candidates.join(", ")}). Copy api/content.example.json to api/content.json.`,
    );
}

function loadContent() {
    const file = resolveContentFile();
    const content = JSON.parse(readFileSync(file, "utf8"));
    assertContent(content, file);
    console.log(`[content] ${file}`);
    return content;
}

const content = loadContent();
const { projects, showcaseCards, contactRows, stackGroups, site, about } = content;

function corsHeaders(request) {
    const origin = request.headers.origin;
    if (!origin) return {};
    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return {
            "Access-Control-Allow-Origin": allowedOrigins.includes("*") ? "*" : origin,
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Max-Age": "86400",
            Vary: "Origin",
        };
    }
    return {};
}

function send(response, status, payload, extraHeaders = {}) {
    const body = payload === undefined ? "" : JSON.stringify(payload);
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        "Cache-Control": "no-store",
        ...extraHeaders,
    });
    response.end(body);
}

async function readJson(request) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
        size += chunk.length;
        if (size > 64 * 1024) throw new Error("Payload too large");
        chunks.push(chunk);
    }
    if (!chunks.length) return {};
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/* -------------------------------------------------------------------------- */
/* Assets — logos and showcase shots, streamed from disk                      */
/* -------------------------------------------------------------------------- */

/**
 * The images are not part of the site bundle (nor of git): the API owns them.
 *
 * `GET /api/assets/logos/typescript.svg` maps to `<ASSETS_DIR>/logos/typescript.svg`.
 * The directory defaults to `api/assets` and can be moved with `ASSETS_DIR`.
 * Paths are resolved, then checked to be inside the directory, so `..` cannot
 * escape it.
 */
const ASSETS_DIR = resolve(process.env.ASSETS_DIR ?? join(HERE, "assets"));

const MIME = {
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
};

function serveAsset(response, requestPath) {
    let relative;
    try {
        relative = decodeURIComponent(requestPath);
    } catch {
        send(response, 400, { error: "Malformed path" });
        return;
    }

    const file = resolve(ASSETS_DIR, relative);
    if (file !== ASSETS_DIR && !file.startsWith(ASSETS_DIR + sep)) {
        send(response, 403, { error: "Forbidden" });
        return;
    }

    if (!existsSync(file) || !statSync(file).isFile()) {
        send(response, 404, { error: "Asset not found", path: relative });
        return;
    }

    const { size } = statSync(file);
    response.writeHead(200, {
        "Content-Type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
        "Content-Length": size,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
    });

    const stream = createReadStream(file);
    stream.on("error", () => response.destroy());
    stream.pipe(response);
}

function validateContact(payload) {
    const errors = [];
    if (typeof payload.name !== "string" || payload.name.trim().length < 2) {
        errors.push("name must be at least 2 characters");
    }
    if (typeof payload.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        errors.push("email must be a valid address");
    }
    if (typeof payload.message !== "string" || payload.message.trim().length < 10) {
        errors.push("message must be at least 10 characters");
    }
    return errors;
}

const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const cors = corsHeaders(request);

    if (request.method === "OPTIONS") {
        response.writeHead(204, cors);
        response.end();
        return;
    }

    try {
        if (request.method === "GET" && path === "/api/health") {
            send(response, 200, {
                status: "ok",
                uptime: Math.round((Date.now() - STARTED_AT) / 1000),
                version: process.env.npm_package_version ?? "0.1.0",
            }, cors);
            return;
        }

        if (request.method === "GET" && path.startsWith("/api/assets/")) {
            serveAsset(response, path.slice("/api/assets/".length));
            return;
        }

        if (request.method === "GET" && path === "/api/projects") {
            send(response, 200, projects, {
                ...cors,
                "Cache-Control": "public, max-age=60",
            });
            return;
        }

        if (request.method === "GET" && path === "/api/showcase") {
            send(response, 200, { cards: showcaseCards }, {
                ...cors,
                "Cache-Control": "public, max-age=60",
            });
            return;
        }

        if (request.method === "GET" && path === "/api/contacts") {
            send(response, 200, { contacts: contactRows }, {
                ...cors,
                "Cache-Control": "public, max-age=60",
            });
            return;
        }

        if (request.method === "GET" && path === "/api/stack") {
            send(response, 200, { groups: stackGroups }, {
                ...cors,
                "Cache-Control": "public, max-age=60",
            });
            return;
        }

        if (request.method === "GET" && path === "/api/site") {
            send(response, 200, { site }, {
                ...cors,
                "Cache-Control": "public, max-age=60",
            });
            return;
        }

        if (request.method === "GET" && path === "/api/about") {
            send(response, 200, about, {
                ...cors,
                "Cache-Control": "public, max-age=60",
            });
            return;
        }

        if (request.method === "POST" && path === "/api/contact") {
            const payload = await readJson(request);
            const errors = validateContact(payload);

            if (errors.length) {
                send(response, 422, { errors }, cors);
                return;
            }

            // Replace with an actual delivery mechanism (SMTP, queue, webhook...).
            console.log(`[contact] ${payload.name} <${payload.email}> -> ${CONTACT_TO}`);

            send(response, 202, { accepted: true }, cors);
            return;
        }

        send(response, 404, { error: "Not found", path }, cors);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error";
        send(response, message === "Payload too large" ? 413 : 500, { error: message }, cors);
    }
});

/* -------------------------------------------------------------------------- */
/* Presence — live cursors over WebSocket                                     */
/* -------------------------------------------------------------------------- */

/**
 * Minimal RFC 6455 implementation (text/ping/pong, no extensions) so the
 * sample API stays dependency-free.
 *
 * Protocol
 *   client -> server  { type: "cursor", path, position: [x, y] | null }
 *   server -> client  { type: "welcome", id }
 *                     { type: "roster", cursors: [{ id, path, position }] }
 *                     { type: "cursor", id, path, position }
 *                     { type: "leave", id }
 *
 * `position` is **normalised against the document** (0 → 1 of the sender's
 * whole scrollable page), not in CSS pixels: the receiver is almost never the
 * same window size nor at the same scroll offset, so it projects the point back
 * into its own viewport. The server only clamps and rounds it; it never
 * interprets it.
 *
 * The server owns the id: a client never picks one, and every update is
 * rebroadcast with the id the server assigned. `path` scopes the broadcast so
 * a cursor only reaches the clients looking at the same page.
 */
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_SESSIONS = 200;
const HEARTBEAT_MS = 30_000;

let nextCursorId = 1;

/** Trailing slashes must not split one page into two rooms (`/x/` == `/x`). */
function normalizePath(value) {
    if (!value || value === "/") return "/";
    return value.replace(/\/+$/, "") || "/";
}
/** @type {Map<number, { id: number, socket: import("node:net").Socket, path: string, position: [number, number] | null, alive: boolean, buffer: Buffer }>} */
const sessions = new Map();

function sendFrame(socket, opcode, payload) {
    const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, "utf8");
    const length = data.length;
    let header;

    if (length < 126) {
        header = Buffer.from([0x80 | opcode, length]);
    } else if (length < 65_536) {
        header = Buffer.alloc(4);
        header[0] = 0x80 | opcode;
        header[1] = 126;
        header.writeUInt16BE(length, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x80 | opcode;
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(length), 2);
    }

    socket.write(Buffer.concat([header, data]));
}

function sendJson(session, payload) {
    sendFrame(session.socket, 0x1, JSON.stringify(payload));
}

function broadcast(payload, path, exceptId) {
    for (const session of sessions.values()) {
        if (session.id === exceptId || session.path !== path) continue;
        sendJson(session, payload);
    }
}

function rosterFor(path, exceptId) {
    const cursors = [];
    for (const session of sessions.values()) {
        if (session.id === exceptId || session.path !== path) continue;
        cursors.push({ id: session.id, path: session.path, position: session.position });
    }
    return cursors;
}

function dropSession(session) {
    if (!sessions.delete(session.id)) return;
    session.socket.destroy();
    if (session.path) broadcast({ type: "leave", id: session.id }, session.path);
}

function onClientMessage(session, raw) {
    let message;
    try {
        message = JSON.parse(raw);
    } catch {
        return;
    }

    if (!message || message.type !== "cursor") return;
    if (typeof message.path !== "string" || message.path.length > 200) return;

    const path = normalizePath(message.path);
    // Document-normalised coordinates: clamp to 0 → 1, keep 4 decimals (~0.2 px
    // on a 2000 px document) instead of rounding to whole pixels.
    const position =
        Array.isArray(message.position) &&
            message.position.length === 2 &&
            message.position.every((value) => typeof value === "number" && Number.isFinite(value))
            ? message.position.map((value) => Math.round(Math.min(1, Math.max(0, value)) * 10_000) / 10_000)
            : null;

    const changedPath = session.path !== path;
    if (changedPath && session.path) {
        broadcast({ type: "leave", id: session.id }, session.path);
    }

    session.path = path;
    session.position = position;

    if (changedPath) {
        sendJson(session, { type: "roster", cursors: rosterFor(path, session.id) });
    }

    broadcast({ type: "cursor", id: session.id, path, position }, path, session.id);
}

function readFrames(session, chunk) {
    session.alive = true;
    session.buffer = session.buffer.length ? Buffer.concat([session.buffer, chunk]) : chunk;

    for (; ;) {
        const buffer = session.buffer;
        if (buffer.length < 2) return;

        const opcode = buffer[0] & 0x0f;
        const masked = (buffer[1] & 0x80) !== 0;
        let length = buffer[1] & 0x7f;
        let offset = 2;

        if (length === 126) {
            if (buffer.length < 4) return;
            length = buffer.readUInt16BE(2);
            offset = 4;
        } else if (length === 127) {
            if (buffer.length < 10) return;
            length = Number(buffer.readBigUInt64BE(2));
            offset = 10;
        }

        const maskLength = masked ? 4 : 0;
        if (buffer.length < offset + maskLength + length) return;

        const mask = masked ? buffer.subarray(offset, offset + 4) : null;
        const payload = Buffer.from(buffer.subarray(offset + maskLength, offset + maskLength + length));
        session.buffer = buffer.subarray(offset + maskLength + length);

        if (mask) {
            for (let index = 0; index < payload.length; index += 1) {
                payload[index] ^= mask[index & 3];
            }
        }

        if (opcode === 0x8) {
            dropSession(session);
            return;
        }
        if (opcode === 0x9) {
            sendFrame(session.socket, 0xa, payload);
            continue;
        }
        if (opcode === 0xa) continue;
        if (opcode === 0x1 || opcode === 0x0) onClientMessage(session, payload.toString("utf8"));
    }
}

server.on("upgrade", (request, socket) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const key = request.headers["sec-websocket-key"];

    if (!url.pathname.endsWith("/ws") || !key || sessions.size >= MAX_SESSIONS) {
        socket.destroy();
        return;
    }

    const accept = createHash("sha1")
        .update(key + WS_GUID)
        .digest("base64");

    socket.write(
        [
            "HTTP/1.1 101 Switching Protocols",
            "Upgrade: websocket",
            "Connection: Upgrade",
            `Sec-WebSocket-Accept: ${accept}`,
            "",
            "",
        ].join("\r\n"),
    );
    socket.setNoDelay(true);

    const session = {
        id: nextCursorId++,
        socket,
        path: "",
        position: null,
        alive: true,
        buffer: Buffer.alloc(0),
    };

    sessions.set(session.id, session);
    sendJson(session, { type: "welcome", id: session.id });

    socket.on("data", (data) => readFrames(session, data));
    socket.on("close", () => dropSession(session));
    socket.on("error", () => dropSession(session));
});

const heartbeat = setInterval(() => {
    for (const session of sessions.values()) {
        if (!session.alive) {
            dropSession(session);
            continue;
        }
        session.alive = false;
        sendFrame(session.socket, 0x9, Buffer.alloc(0));
    }
}, HEARTBEAT_MS);
heartbeat.unref();

server.listen(PORT, "0.0.0.0", () => {
    console.log(`portfolio-api listening on :${PORT} (ws: /ws)`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
        server.close(() => process.exit(0));
    });
}
