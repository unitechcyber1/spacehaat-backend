import asyncRedis from "async-redis";
import redis from '../config/redis.js';

class Redis {
    constructor() {
        this.client = null;
        return {
            set: this.set.bind(this),
            get: this.get.bind(this),
            flushAll: this.flushAll.bind(this),
            delete: this.delete.bind(this),
            init: this.init.bind(this)
        }
    }

    init() {
        this.client = asyncRedis.createClient({
            port: redis.port,
            host: redis.host,
            auth: redis.password,
            db: 4
        });
        this.client.on("error", function (err) {
            throw ('Error in Redis connection')
        });
        this.client.on('connect', function () {
            console.info('Redis connected')
        });
    }

    async set(key, value) {
        try {
            await this.client.set(key, value);
            return true;
        } catch (e) {
            throw (e)
        }
    }

    async get(key) {
        try {
            const value = await this.client.get(key);
            return value;
        } catch (e) {
            throw (e)
        }
    }

    async flushAll(key) {
        try {
            await this.client.flushall(key);
            return true;
        } catch (e) {
            throw (e)
        }
    }

    async delete(key){
        try {
            await this.client.del(key);
            return true;
        }catch(e){
            throw(e)
        }
    }

    _checkKey() {
        // To do
    }
}

export default new Redis();