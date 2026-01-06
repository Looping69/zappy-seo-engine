import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function copyBuild() {
    const source = resolve(__dirname, '../dist');
    const target = resolve(__dirname, '../../frontend/dist');

    console.log(`Copying build artifacts...`);
    console.log(`From: ${source}`);
    console.log(`To:   ${target}`);

    try {
        // Clean target
        await rm(target, { recursive: true, force: true }).catch(() => { });
        await mkdir(target, { recursive: true });

        // Copy directory
        await cp(source, target, { recursive: true });

        console.log('✅ Build artifacts successfully synced to Encore frontend service.');
    } catch (error) {
        console.error('❌ Failed to sync build artifacts:', error);
        process.exit(1);
    }
}

copyBuild();
