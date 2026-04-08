/*
Making connection on every query insertion and closing connection
if find any optimised way change it (try not to keep connection open)
*/

let MongoClient = require('mongodb').MongoClient;
let config = require('../config');
let Logger = require('../utilities/logger');

export default function(data){
    MongoClient.connect(config.mongoUrl, function(err, client) {
        var db = client.db('olegacylogs');
        data.calledAt = new Date();
        if(!err){
            db.collection('apilogs').insertOne(data, function(err) {
                if(err) Logger.error(`Mongo insertion error ${typeof err === 'object'?JSON.stringify(err) : err}`)
                client.close();
            });
        }else{
            Logger.error(`Mongo connection error ${typeof err === 'object'?JSON.stringify(err) : err}`)
        }  
    });       
}
