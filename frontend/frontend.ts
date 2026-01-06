import { api } from "encore.dev/api";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Serve the dashboard HTML using raw endpoint
export const dashboard = api.raw(
    { expose: true, method: "GET", path: "/ui" },
    async (req, res) => {
        try {
            const html = await readFile(join(process.cwd(), "frontend", "index.html"), "utf-8");
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(html);
        } catch (error) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Error loading dashboard");
        }
    }
);

// Serve the swarm visualizer HTML using raw endpoint
export const swarm = api.raw(
    { expose: true, method: "GET", path: "/ui/swarm" },
    async (req, res) => {
        try {
            const html = await readFile(join(process.cwd(), "frontend", "swarm.html"), "utf-8");
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(html);
        } catch (error) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Error loading swarm visualizer");
        }
    }
);

// Redirect root to dashboard
export const home = api.raw(
    { expose: true, method: "GET", path: "/" },
    async (req, res) => {
        res.writeHead(302, { "Location": "/ui" });
        res.end();
    }
);
