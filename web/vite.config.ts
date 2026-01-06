import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        chunkSizeWarningLimit: 1000
    },
    define: {
        'process.env.VITE_API_BASE': JSON.stringify(process.env.VITE_API_BASE)
    },
    server: {
        proxy: {
            '/content': 'http://localhost:4000',
            '/keywords': 'http://localhost:4000',
            '/orchestrator': 'http://localhost:4000',
        }
    }
})
