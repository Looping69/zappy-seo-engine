import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
    },
});

app.use(cors());
app.use(express.json());
// Serve static files from the UI directory (we'll create this)
app.use(express.static(path.join(__dirname, "ui")));

let activeProcess: any = null;

io.on("connection", (socket) => {
    console.log("Client connected");

    socket.on("run-command", ({ command, args }) => {
        if (activeProcess) {
            socket.emit("output", "\n⚠️ A process is already running. Please wait or stop it first.\n");
            return;
        }

        console.log(`Running: tsx src/generate.ts ${args.join(" ")}`);
        socket.emit("status", "running");

        // Use npx tsx to ensure we use the local version
        activeProcess = spawn("npx", ["tsx", "src/generate.ts", ...args], {
            shell: true,
            env: process.env
        });

        activeProcess.stdout.on("data", (data: any) => {
            socket.emit("output", data.toString());
        });

        activeProcess.stderr.on("data", (data: any) => {
            socket.emit("output", `\x1b[31m${data.toString()}\x1b[0m`);
        });

        activeProcess.on("close", (code: number) => {
            activeProcess = null;
            socket.emit("status", "idle");
            socket.emit("output", `\n✅ Process exited with code ${code}\n`);
        });
    });

    socket.on("seed-keywords", ({ topic }) => {
        if (activeProcess) {
            socket.emit("output", "\n⚠️ System busy. Please wait.\n");
            return;
        }

        console.log(`Seeding: tsx src/seed.ts "${topic}"`);
        socket.emit("status", "running");

        activeProcess = spawn("npx", ["tsx", "src/seed.ts", topic], {
            shell: true,
            env: process.env
        });

        activeProcess.stdout.on("data", (data: any) => {
            socket.emit("output", data.toString());
        });

        activeProcess.stderr.on("data", (data: any) => {
            socket.emit("output", `\x1b[31m${data.toString()}\x1b[0m`);
        });

        activeProcess.on("close", (code: number) => {
            activeProcess = null;
            socket.emit("status", "idle");
            socket.emit("output", `\n✅ Seeding complete with code ${code}\n`);
        });
    });

    socket.on("stop-command", () => {
        if (activeProcess) {
            activeProcess.kill();
            activeProcess = null;
            socket.emit("status", "idle");
            socket.emit("output", "\n🛑 Process stopped by user.\n");
        }
    });
});

const PORT = process.env.PORT || 3334;
httpServer.listen(PORT, () => {
    console.log(`
🚀 Zappy Content Engine Control Panel
📡 Server running on http://localhost:${PORT}
  `);
});
