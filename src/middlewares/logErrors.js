import Logger from '../utilities/logger.js';

export default function logErrors(err, req, res, next) {
  // TO DO:- handle for err object
  Logger.error(err)
  console.log(err);
  next(err)
}