/** Local MongoDB when MONGODB_URI / MONGO_URI / DATABASE_URL is unset */
const DEFAULT_MONGODB_URI = 'mongodb://127.0.0.1:27017/spacehaat-prod';

const uri = (
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.DATABASE_URL ||
    DEFAULT_MONGODB_URI
).trim();

const database = {
    uri
};
export default database;
