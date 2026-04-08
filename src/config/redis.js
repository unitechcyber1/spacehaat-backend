// import env from '../utilities/env';

const redis = {
  /**
   * Redis use database name as index by default its provides 1-15 indexes
   **/
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  db: process.env.REDIS_DB || 1,
  password: process.env.REDIS_PASSWORD || ''
};

export default redis;
