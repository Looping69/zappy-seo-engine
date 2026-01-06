import { api } from "encore.dev/api";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Serve the built React app static assets
export const assets = api.static({
    expose: true,
    path: "/assets",
    dir: "./dist/assets"
});

// Serve the dashboard (React App Entry)
export const dashboard = api.raw(
    { expose: true, method: "GET", path: "/ui/*path" },
    async (req, res) => {
        try {
            const html = await readFile(join(process.cwd(), "frontend", "dist", "index.html"), "utf-8");
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(html);
        } catch (error) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Error loading dashboard");
        }
    }
);

// Redirect root to dashboard
export const home = api.raw(
    { expose: true, method: "GET", path: "/" },
    async (req, res) => {
        res.writeHead(302, { "Location": "/ui/" });
        res.end();
    }
);
