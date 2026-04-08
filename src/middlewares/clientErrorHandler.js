import { err as constErr } from '../utilities/constants.js';
export function clientErrorHandler(err, req, res, next) {
    const mongoErrorObj = {
        11000: {
            code: 409,
            message: 'Record already Exits'
        },
        2: {
            code: 400,
            message: 'Bad Request'
        },
        9: {
            code: 400,
            message: 'Failed to parse'
        }
    }
    if (err) {
        const errObject = {
            type: 'Error',
            code: 500,
            message: constErr[500].message
        }
        switch (err.name) {
            case 'MongoError': {
                errObject.code = mongoErrorObj[err.code].code;
                errObject.message = mongoErrorObj[err.code].message;
                break;
            }
            case 'CastError': {
                if (err.kind == 'ObjectId') {
                    errObject.code = 400;
                    errObject.message = 'Invalid Id'
                }
                break;
            }
            case 'cofynd': {
                errObject.code = err.code;
                errObject.message = err.message;
                break;
            }
            case 'ValidationError': {
                errObject.code = 400;
                errObject.message = err.message;
                break;
            }
        }
        return res.status(errObject.code).json(errObject)
    }
}