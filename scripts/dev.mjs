/**
 * Starts the site and the presence server together.
 *
 * Both are spawned as plain Node processes (no shell, no extra dependency), so
 * Ctrl+C tears the pair down cleanly on Windows, macOS and Linux.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

const RESET = "\u001b[0m";

const tasks = [
  { name: "web", color: "\u001b[38;5;147m", args: [nextBin, "dev"] },
  { name: "ws", color: "\u001b[38;5;114m", args: ["api/server.mjs"] },
];

const children = [];
let shuttingDown = false;

function forward(task, stream, chunk) {
  for (const line of chunk.toString().split(/\r?\n/)) {
    if (!line.trim()) continue;
    stream.write(`${task.color}${task.name.padEnd(3)}${RESET} ${line}\n`);
  }
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { child } of children) {
    if (!child.killed) child.kill();
  }
  // Give the children a beat to release their ports before we exit.
  setTimeout(() => process.exit(code), 150);
}

for (const task of tasks) {
  const child = spawn(process.execPath, task.args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "1" },
  });

  child.stdout.on("data", (chunk) => forward(task, process.stdout, chunk));
  child.stderr.on("data", (chunk) => forward(task, process.stderr, chunk));

  child.on("exit", (code) => {
    if (shuttingDown) return;
    process.stdout.write(`${task.color}${task.name}${RESET} stopped (code ${code})\n`);
    shutdown(code ?? 0);
  });

  children.push({ task, child });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(0));
}

process.stdout.write(
  `${tasks[0].color}web${RESET} :3000  ·  ${tasks[1].color}ws${RESET} :3001\n\n`,
);
