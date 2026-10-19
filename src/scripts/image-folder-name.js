/**
 * Fills `folder_name` on Image documents from their `s3_link`
 * (https://img.spacehaat.com/images/original/a.jpg -> 'images/original').
 *
 * Only images with an empty `folder_name` are touched; existing values are kept
 * (some were written by the PG system as tags like 'pg-propertyMedia').
 *
 * Usage:
 *   node src/scripts/image-folder-name.js           Preview counts per folder, no DB writes.
 *   node src/scripts/image-folder-name.js --apply   Write folder_name.
 */
import '../config/loadEnv.js';
import mongoose from 'mongoose';
import database from '../config/database.js';
import models from '../models/index.js';
import { folderFromS3Link } from '../utilities/file.js';

const Image = models['Image'];
const BATCH_SIZE = 1000;
const apply = process.argv.includes('--apply');

async function main() {
    await mongoose.connect(database.uri);
    try {
        const condition = { folder_name: { $in: [null, ''] }, s3_link: { $nin: [null, ''] } };
        const cursor = Image.collection.find(condition, { projection: { s3_link: 1 } });

        const perFolder = {};
        let seen = 0;
        let written = 0;
        let ops = [];

        for await (const image of cursor) {
            seen++;
            const folder = folderFromS3Link(image.s3_link);
            perFolder[folder || '(bucket root)'] = (perFolder[folder || '(bucket root)'] || 0) + 1;
            ops.push({ updateOne: { filter: { _id: image._id }, update: { $set: { folder_name: folder } } } });
            if (ops.length >= BATCH_SIZE) {
                if (apply) written += (await Image.collection.bulkWrite(ops, { ordered: false })).modifiedCount;
                ops = [];
            }
        }
        if (apply && ops.length) written += (await Image.collection.bulkWrite(ops, { ordered: false })).modifiedCount;

        console.log(`Images with empty folder_name: ${seen}`);
        console.log(Object.entries(perFolder).sort((a, b) => b[1] - a[1]));
        console.log(apply ? `Wrote folder_name on ${written} images.` : 'Preview only. Run with --apply to write.');
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
