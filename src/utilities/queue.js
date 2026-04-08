import kue  from 'kue';
import logger from './logger.js';
import redis from '../config/redis.js'

const options = {
  prefix: 'q',
  redis: {
    port: redis.port,
    host: redis.host,
    auth: redis.password,
    db: 3
  },
  jobEvents: false // for memory optimization
};

const interval = 5000;

class Queue{
  constructor(){
    return {
      init: this.init.bind(this),
      activity: this.activity.bind(this),
      log: this.log.bind(this),
      mail: this.mail.bind(this),
      message: this.message.bind(this),
      execute: this.execute.bind(this)
    }
  }

  init(){
    this.q = kue.createQueue(options);
    this.q.watchStuckJobs(interval);
    this.job = kue.Job;
    this._queue_events();
  }

  activity(data, priority = 'normal'){
    return this._push('activity', data, priority);
  }

  log(data, priority = 'normal'){
    return this._push('log', data, priority);
  }

  mail(data, priority = 'normal'){
    return this._push('mail', data, priority);
  }

  message(data, priority = 'normal'){
    return this._push('message', data, priority);
  }

  execute(type, cb){
    this.q.process(type, 1, (job, callback) => {
      cb(job.data, callback);
    })
  }

  _push(id, data, priority = 'normal'){
    return this.q.create(id, data).priority(priority).removeOnComplete(true).attempts(5).save();
  }

  _queue_events(){
    this.q.on('error', err => console.log(err));
  }
}

export default  new Queue();
