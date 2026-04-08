const database = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || '27017',
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'cofynd-prod',
    replica: process.env.DB_REPLICA || false
};
//  database.uri =  `mongodb://yadavharinandan980:t9LTh5Jw7unKjcRW@ac-3uih9di-shard-00-00.esx4wuj.mongodb.net:27017,ac-3uih9di-shard-00-01.esx4wuj.mongodb.net:27017,ac-3uih9di-shard-00-02.esx4wuj.mongodb.net:27017/?ssl=true&replicaSet=atlas-k8yauc-shard-0&authSource=admin&retryWrites=true&w=majority`
 database.uri = `mongodb://${database.host}/${database.name}`;
if (database.user !== '') database.uri = `mongodb://${database.user}:${encodeURIComponent(database.password)}@${database.host}:${database.port}/${database.name}?authSource=admin`;

console.log(database, database.uri)

export default database;
