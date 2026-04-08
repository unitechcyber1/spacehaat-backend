import env from '../utilities/env.js';
import app from './app.js';
import database from './database.js';
import redis from './redis.js';
import storage from './storage.js';
import log from './log.js';
import mail from './mail.js';

const config = {
  app,
  database,
  redis,
  storage,
  log,
  mail
};
export default config;
