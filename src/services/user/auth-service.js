import models from '../../models/index.js';
import app from '../../config/app.js';
import { requireEncryptionKey } from '../../utilities/helper.js';
import messageService from '../../utilities/messageService.js';
import redis from '../../utilities/redis.js';
const User = models['User'];

import jwt from 'jsonwebtoken';
import aes256 from 'aes256';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client();
const MAX_OTP_ATTEMPTS = 5;


class UserAuthService {
    constructor() {
        return {
            authenticate: this.authenticate.bind(this),
            authenticateVendor: this.authenticateVendor.bind(this),
            createToken: this.createToken.bind(this),
            createVendorToken: this.createVendorToken.bind(this),
            googleVendorLogin: this.googleVendorLogin.bind(this),
            createVendorTokenForRegister: this.createVendorTokenForRegister.bind(this),
            signUpUser: this.signUpUser.bind(this),
            validateUser: this.validateUser.bind(this),
            resendOTP: this.resendOTP.bind(this),
            createUser: this.createUser.bind(this),
            updateUser: this.updateUser.bind(this),
            vendorSignUpUser: this.vendorSignUpUser.bind(this),
            deleteUserByMobile: this.deleteUserByMobile.bind(this),
            findUserByMobile: this.findUserByMobile.bind(this)
        }
    }

    async authenticate({ phone_number, dial_code }) {
        try {
            let user = await User.findOne({
                phone_number
            });
            if (user) {
                await User.findOneAndUpdate({ phone_number }, { dial_code: dial_code });
            }
            if (!user) {
                user = await User.create({ phone_number, dial_code });
            }
            const otp = this._randomCodeGenerator();
            await User.findOneAndUpdate({ phone_number }, { otp_expires: new Date(), otp, otp_attempts: 0 });
            if (this._forTestingPurpose(user.phone_number)) {
                return user._id; /** for testing purpose default number is entered */
            }
            await messageService.sendOTP(phone_number, otp, user.dial_code);
            return user._id;
        } catch (e) {
            throw (e)
        }
    };

    async authenticateVendor({ phone_number }) {
        try {
            let user = await User.findOne({
                phone_number
            });
            if (!user) {
                this._throwException(`Your number is not registered, please signup.`);
            }
            const otp = this._randomCodeGenerator();
            await User.findOneAndUpdate({ phone_number }, { otp_expires: new Date(), otp, otp_attempts: 0 });
            if (this._forTestingPurpose(user.phone_number)) {
                return user._id; /** for testing purpose default number is entered */
            }
            await messageService.sendOTP(phone_number, otp, user.dial_code);
            return user._id;
        } catch (e) {
            throw (e)
        }
    };

    async validateUser({ phone_number, otp }) {
        try {
            let user = await User.findOne({ phone_number }).populate('profile_pic');
            if (this._forTestingPurpose(phone_number, otp)) {
                return { user, message: 'testing user verified' };
            }
            if (!user) {
                this._throwException(`opps! user not exists`);
            }
            // A code is valid for 30 minutes, for one use, with at most 5 wrong tries.
            if (!user.otp || !this._checkExpiry(user)) {
                this._throwException('OTP expired. Please request a new code.');
            }
            if ((user.otp_attempts || 0) >= MAX_OTP_ATTEMPTS) {
                this._throwException('Too many wrong attempts. Please request a new code.');
            }
            if (user.otp === +otp) {
                const message = 'OTP verified successfully';
                await User.findOneAndUpdate(
                    { phone_number: phone_number },
                    { is_mobile_verified: true, otp: null, otp_attempts: 0 }
                );
                return { user, message };
            } else {
                await User.updateOne({ _id: user._id }, { $inc: { otp_attempts: 1 } });
                this._throwException('OtP mismatched!!');
            }
        } catch (error) {
            throw (error);
        }
    }

    async createToken(user) {
        try {
            const encryptedKey = requireEncryptionKey();
            const { _id, role } = user;
            let obj = {};
            obj.id = await aes256.encrypt(encryptedKey, _id.toString());
            obj.role = await aes256.encrypt(encryptedKey, role.toString());
            obj.phone_number = await aes256.encrypt(encryptedKey, user.phone_number.toString());
            const token = jwt.sign(obj, app.superSecretForUser, {
                expiresIn: '30d'
            });
            redis.set(user.id, token);
            return token;
        } catch (e) {
            throw (e)
        }
    }

    async createVendorTokenForRegister(user) {
        try {
            const encryptedKey = requireEncryptionKey();
            const { _id, role, phone_number } = user;
            let obj = {};
            obj.id = await aes256.encrypt(encryptedKey, _id.toString());
            obj.role = await aes256.encrypt(encryptedKey, role.toString());
            obj.phone_number = await aes256.encrypt(encryptedKey, user.phone_number.toString());
            const otp = this._randomCodeGenerator();
            await User.findOneAndUpdate({ phone_number: user.phone_number }, { otp_expires: new Date(), otp, otp_attempts: 0 });
            if (this._forTestingPurpose(user.phone_number)) {
                return user._id; /** for testing purpose default number is entered */
            }
            await messageService.sendOTP(user.phone_number, otp, user.dial_code);
            const token = jwt.sign(obj, app.superSecretForAdmin, {
                expiresIn: '30d'
            });
            redis.set(user.id, token);
            return token;
        } catch (e) {
            throw (e)
        }
    }

    async createVendorToken(user) {
        try {
            const encryptedKey = requireEncryptionKey();
            const { _id, role, phone_number } = user;
            let obj = {};
            obj.id = await aes256.encrypt(encryptedKey, _id.toString());
            obj.role = await aes256.encrypt(encryptedKey, role.toString());
            obj.phone_number = await aes256.encrypt(encryptedKey, user.phone_number.toString());
            obj.userId = _id;
            await User.findOneAndUpdate({ phone_number: phone_number }, { role: 'vendor' });
            const token = jwt.sign(obj, app.superSecretForAdmin, {
                expiresIn: '30d'
            });
            redis.set(user.id, token);
            return token;
        } catch (e) {
            throw (e)
        }
    }

    /**
     * "Continue with Google" for hosts. Verifies the Google ID token, then finds the host by
     * email or creates one. A new host must also give a mobile number (returns `needsPhone`).
     * A number that already belongs to another account is never linked automatically, so a
     * Google login cannot take over someone else's phone-based account.
     */
    async googleVendorLogin({ credential, name, phone_number, dial_code }) {
        if (!app.googleClientId) {
            this._throwException('Google sign-in is not configured.');
        }
        if (!credential) {
            this._throwException('Google sign-in failed. Please try again.');
        }

        let payload;
        try {
            const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: app.googleClientId });
            payload = ticket.getPayload();
        } catch (e) {
            this._throwException('Google sign-in expired or is invalid. Please try again.');
        }
        if (!payload?.email || !payload.email_verified) {
            this._throwException('Your Google account email is not verified.');
        }

        const email = payload.email.trim().toLowerCase();
        const emailRe = new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        // Email is not unique on User: prefer a host account, then the newest.
        const matches = await User.find({ email: emailRe }).sort({ _id: -1 }).limit(5);
        let user = matches.find((u) => u.role === 'vendor' || (u.roles || []).includes('vendor')) || matches[0];

        if (!user) {
            const phone = String(phone_number || '').replace(/\D/g, '').slice(-10);
            if (phone.length !== 10) {
                return { needsPhone: true, profile: { name: payload.name || '', email } };
            }
            const phoneOwner = await User.findOne({ phone_number: phone });
            if (phoneOwner) {
                this._throwException(
                    'This mobile number is already registered with another account. Sign in with the Google account that uses the same email, or contact us to link them.'
                );
            }
            user = await User.create({
                name: String(name || payload.name || '').trim(),
                email,
                phone_number: phone,
                dial_code: dial_code || '+91',
                role: 'vendor',
                roles: ['vendor'],
                login_type: 'google',
                is_email_verified: true,
                is_profile_updated: true,
            });
        } else {
            if (user.is_active === false) {
                this._throwException('This account is disabled. Please contact us.');
            }
            const updates = { is_email_verified: true };
            if (!user.name && (name || payload.name)) updates.name = String(name || payload.name).trim();
            // Promote plain users to hosts; never demote admins or sales accounts.
            if (!user.role || user.role === 'user') updates.role = 'vendor';
            user = await User.findByIdAndUpdate(user._id, updates, { new: true });
        }

        const token = await this._signVendorToken(user);
        return { user, token };
    }

    /** Same token shape as {@link createVendorToken}, without changing the user's role. */
    async _signVendorToken(user) {
        const encryptedKey = requireEncryptionKey();
        const obj = {
            id: await aes256.encrypt(encryptedKey, user._id.toString()),
            role: await aes256.encrypt(encryptedKey, String(user.role || 'vendor')),
            phone_number: await aes256.encrypt(encryptedKey, String(user.phone_number || '')),
            userId: user._id,
        };
        const token = jwt.sign(obj, app.superSecretForAdmin, { expiresIn: '30d' });
        await redis.set(user.id, token);
        return token;
    }

    async signUpUser({ id, name, gender, email, dob }) {
        try {
            let user = await User.findOne({ _id: id, is_profile_updated: false });
            if (!user) {
                this._throwException(`Profile not found or already completed its sign up process`);
            }
            if (this._checkExpiry(user)) {
                return await User.findOneAndUpdate({ _id: id }, {
                    email,
                    name,
                    gender,
                    dob,
                    is_profile_updated: true
                }, { new: true });
            } else {
                this._throwException(`code expired. Please login with fresh OTP`);
            }
        } catch (e) {
            throw (e)
        }
    }

    async vendorSignUpUser({ name, email, phone_number, dial_code }, role = 'vendor') {
        try {
            let user = await User.findOne({ phone_number: phone_number });
            if (user) {
                this._throwException(`User already registered, please login.`);
            } else {
                return await User.create({
                    email,
                    name,
                    phone_number,
                    role,
                    dial_code,
                    is_profile_updated: true
                });
            }
        } catch (e) {
            throw (e)
        }
    }

    async resendOTP({ phone_number, dial_code }) {
        try {
            let user = await User.findOne({ phone_number });
            const otp = this._randomCodeGenerator();
            await User.findOneAndUpdate({ _id: user.id }, { otp, otp_expires: new Date(), otp_attempts: 0 })
            /** TODO will change the template for resend code  */
            const result = await messageService.sendOTP(phone_number, otp, dial_code);
            return result.data;
        } catch (error) {
            throw (error);
        }
    }
    async updateUser({ phone_number, increseCredits = 0, reduceCredits = false, isFreeCredit = false }) {
        try {
            let user = await User.findOne({ phone_number });
            let userData = {};

            if (!user) throw new Error("User not found");

            let currentCredits = Number(user.credits) || 0;

            if (user.credits > 0 && reduceCredits) {
                userData.creditUser = await User.findOneAndUpdate(
                    { phone_number },
                    { credits: currentCredits - 1, isFreeCredit },
                    { new: true }
                );
            }

            if (increseCredits > 0) {
                userData.creditUser = await User.findOneAndUpdate(
                    { phone_number },
                    { credits: currentCredits + Number(increseCredits) },
                    { new: true }
                );
            }

            userData.user = user;
            return userData;
        } catch (e) {
            throw e;
        }
    }

    async createUser({ phone_number, email, name, dial_code, credits }) {
        try {
            let user = await User.findOne({ phone_number });
            const updatePayload = {
                phone_number,
                dial_code,
                email,
                name,
                is_profile_updated: true,
            };
            if (!user || !user.is_profile_updated) {
                updatePayload.credits = credits;
                updatePayload.isFreeCredit = true;
                user = await User.findOneAndUpdate({ phone_number }, updatePayload, { upsert: true, new: true })
            }
            if (user) {
                if (user.credits == null) {
                    updatePayload.credits = credits;
                    updatePayload.isFreeCredit = true;
                }
                user = await User.findOneAndUpdate({ phone_number }, updatePayload, { new: true })
            }
            const otp = this._randomCodeGenerator();
            // const otp = "0000"
            await User.findOneAndUpdate({ _id: user.id }, { otp, otp_expires: new Date(), otp_attempts: 0 });
            await messageService.sendOTP(phone_number, otp, dial_code);
            return user;
        } catch (error) {
            throw (error);
        }
    }


    async deleteUserByMobile({ phone_number }) {
        try {
            let user = await User.deleteOne({ phone_number })
            return user;
        } catch (error) {
            throw (error);
        }
    }


    async findUserByMobile({ phone_number }) {
        try {
            return await User.findOne({ phone_number });
        } catch (error) {
            throw (error);
        }
    }

    _randomCodeGenerator() {
        return Math.floor(1000 + Math.random() * 9000);
    }

    _checkExpiry(user) {
        const t1 = new Date();
        const t2 = new Date(user.otp_expires);
        var diff = (t1.getTime() - t2.getTime()) / 1000;
        diff /= 60;
        var minutes_Between_Dates = Math.abs(Math.round(diff));
        /** for 30 minutes */
        if (minutes_Between_Dates <= 30) {
            return true;
        }
        return false;
    }

    _throwException(message) {
        throw ({
            name: "cofynd",
            code: 400,
            message
        })
    }

    _forTestingPurpose(phone_number, otp) {
        if (app.defaultPhoneNumbers.includes(phone_number) && !otp) {
            return true;
        }
        if (app.defaultPhoneNumbers.includes(phone_number) && otp == app.defaultOTP) {
            return true;
        }
    }
}

export default new UserAuthService();