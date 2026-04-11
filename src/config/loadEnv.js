import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Repo root (…/spacehaat-backend), not dependent on process.cwd() (PM2/Docker may differ). */
const envPath = path.resolve(__dirname, '..', '..', '.env');

dotenv.config({ path: envPath });
dotenv.config();
