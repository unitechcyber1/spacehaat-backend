// models/index.js
import mongoose from 'mongoose';
import fs from 'fs/promises';

// const currentPath = new URL(import.meta.url).pathname.substring(1); // Use import.meta.url for ESM
// const currentDir = decodeURI(currentPath.substring(0, currentPath.lastIndexOf('/')));
const currentPath = new URL(import.meta.url).pathname; // Use import.meta.url for ESM
const currentDir = decodeURI(currentPath.substring(0, currentPath.lastIndexOf('/')));
let models = {};

const files = await fs.readdir(currentDir);

for (const file of files) {
    if (file === "index.js" || !file.endsWith('.js')) {
        continue;
    }

    const name = file.substring(0, file.indexOf('.'));
    const { default: schema } = await import(`./${name}.js`);
    models[name] = mongoose.model(name, schema);
}

export default models;
