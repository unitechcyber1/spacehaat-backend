import express from 'express';

const router = express.Router();
import fs from 'fs/promises';

// const currentPath = new URL(import.meta.url).pathname.substring(1);
// const currentDir = decodeURI(currentPath.substring(0, currentPath.lastIndexOf('/')));

const currentPath = new URL(import.meta.url).pathname; // Use import.meta.url for ESM
const currentDir = decodeURI(currentPath.substring(0, currentPath.lastIndexOf('/')));
// You can create a list of directories to exclude if needed
// const dirs = ['admin', 'customer'];

const files = await fs.readdir(currentDir);

for (const file of files) {
    if (file === "index.js" || !file.endsWith('.js')) {
        continue;
    }

    const name = file.substring(0, file.indexOf('.'));
    const route = await import(`./${name}.js`);
    router.use(route.default);
}

export default router;
