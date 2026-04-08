import jwt from 'jsonwebtoken';
import app from '../config/app.js';
import aes256 from 'aes256';
import redis from '../utilities/redis.js';
import models from '../models/index.js';
const User = models['User']

class CheckToken {
    constructor() {
        return {
            jwtAdminVerify: this.jwtAdminVerify.bind(this),
            jwtUserVerify: this.jwtUserVerify.bind(this)
        }
    }

    async jwtAdminVerify(req, res, next) {
        try {
            const excluded = ['login', 'createAdmin', 'bulkUpload', 'sendOtpAdminUser', 'validateAdminUser', 'forgotAdminPwd', 'webhook'];
            const pathArr = req.path.split('/');
            if (excluded.includes(pathArr[pathArr.length - 1])) return next();
            jwt.verify(req.headers.token, app.superSecretForAdmin, async (err, encoded) => {
                if (err) {
                    return res.status(401).json({ type: 'Error', message: 'Invalid Token' });
                } else {
                    let encryptedKey = app.encryptionKey;
                    let decryptedId = await aes256.decrypt(encryptedKey, encoded.id);
                    const token = await redis.get(decryptedId);
                    const user = await User.findById(encoded.userId);
                    if (!token || !user.is_active) {
                        return res.status(401).json({ type: 'Error', message: 'Invalid Token' });
                    }
                    req.admin = {
                        id: decryptedId,
                        role: 'admin'
                    }
                    next();
                }
            });

        } catch (e) {
            return res.status(401).json({ type: 'Erroro', message: 'Invalid Token' });
        }
    };

    async jwtUserVerify(req, res, next) {
        try {
            let partNeeded = 1; // last part by default
            const excluded = [
                'login',
                'popularWorkSpaces',
                'popularOfficeSpaces',
                'popularCoLivingSpaces',
                'signUp',
                'create',
                'validatePayment',
                'validate',
                'resendOTP',
                'contactUs',
                'cities',
                'brands',
                'seo',
                'enquiryWithoutLogin',
                'blogByType',
                "spaceReviews",
                "spaceAverageReview"
            ];
            const pathArr = req.path.split('/');
            if (pathArr.length > 1) {
                partNeeded = pathArr.length - 1;
            }
            const checkPath = pathArr[pathArr.length - partNeeded];
            if (excluded.includes(checkPath)) return next();
            jwt.verify(req.headers.token, app.superSecretForUser, async (err, encoded) => {
                if (err) {
                    if (checkPath === 'workSpace' ||
                        checkPath === 'workSpaces' ||
                        checkPath === 'blog' ||
                        checkPath === 'officeSpaces' ||
                        checkPath === 'coLivingSpaces' ||
                        checkPath === 'officeSpace' ||
                        checkPath === 'workSpacesByBrand' ||
                        checkPath === 'colivingByBrand' ||
                        checkPath === 'workSpacesByBrandName' ||
                        checkPath === 'similarPlace' ||
                        checkPath === 'similarOfficePlace' ||
                        checkPath === 'seo' ||
                        checkPath === 'getSpacesByCity') { next(); return; }
                    return res.status(401).json({ type: 'Error', message: 'Invalid Token' });
                } else {
                    let encryptedKey = app.encryptionKey;
                    let decryptedId = await aes256.decrypt(encryptedKey, encoded.id);
                    const token = await redis.get(decryptedId);
                    if (!token) {
                        return res.status(401).json({ type: 'Error', message: 'Invalid Token' });
                    }
                    req.user = {
                        id: decryptedId,
                        role: 'user'
                    }
                    next();
                }
            });
        } catch (e) {
            return res.status(401).json({ type: 'Error', message: 'Invalid Token' });
        }
    };
}
export default new CheckToken();