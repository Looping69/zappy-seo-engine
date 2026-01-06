import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/content': 'http://localhost:4000',
            '/keywords': 'http://localhost:4000',
            '/orchestrator': 'http://localhost:4000',
        }
    }
})
