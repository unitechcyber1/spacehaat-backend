import models from '../../models/index.js';
import { hashPassword, requireEncryptionKey } from '../../utilities/helper.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../../config/app.js';
import aes256 from 'aes256';
import redis from '../../utilities/redis.js';
import { ObjectId } from 'mongodb';
import messageService from '../../utilities/messageService.js';
import aws from '../../utilities/aws.js';

const User = models['User'];

class AdminAuthService {
    constructor() {
        return {
            authenticate: this.authenticate.bind(this),
            createToken: this.createToken.bind(this),
            createUser: this.createUser.bind(this),
            userList: this.userList.bind(this),
            deleteUser: this.deleteUser.bind(this),
            deleteUserByPhoneNumber: this.deleteUserByPhoneNumber.bind(this),
            forgotPwd: this.forgotPwd.bind(this),
            sendOTP: this.sendOTP.bind(this),
            validateUser: this.validateUser.bind(this),
            userData: this.userData.bind(this),
            updateUser: this.updateUser.bind(this),
            updateAccess: this.updateAccess.bind(this),
            welcomeMessage: this.welcomeMessage.bind(this)
        }
    }
    hasAdminAccess = (user) => {
        const legacyRole = user.role;
        const rolesArray = Array.isArray(user.roles) ? user.roles : [];

        return (
            legacyRole === 'admin' ||
            legacyRole === 'sales' ||
            rolesArray.includes('admin') ||
            rolesArray.includes('sales')
        );
    };

    async welcomeMessage(user) {
        try {
            let date = new Date();
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            if (user) {
                const msg = await messageService.sendWhatsAppMessageForListing(`+91${user.phone_number}`, [user.name])
                let obj = {
                    toEmails: [user.email],
                    templateName: 'welcome',
                    htmlVariables: {
                        name: user.name,
                        email: user.email,
                        phone_no: user.phone_number,
                        date: date.toLocaleDateString("en-US", options),
                        time: date.toLocaleTimeString('en-US'),
                    },
                    subjectVariables: { name: user.name },
                    bccAddresses: [],
                    ccAddresses: []
                }
                await aws.sendMail(obj);
                return msg;
            }
        } catch (error) {
            throw (error)
        }
    }

    async authenticate({ email, password }) {
        try {
            const user = await User.findOne({
                email,
                $or: [
                    { role: { $in: ['admin', 'sales'] } },
                    { roles: { $in: ['admin', 'sales'] } }
                ]
            });
            if (!user) {
                this._throwException('Invalid Credentials');
            }
            if (!user.is_active) {
                this._throwException('Account is inactive!');
            }
            if (!this.hasAdminAccess(user)) {
                this._throwException("You don't have admin rights.");
            }
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                this._throwException('Invalid Credentials');
            }

            return user;
        } catch (e) {
            throw e;
        }
    }


    async createToken(user) {
        try {
            const encryptedKey = requireEncryptionKey();
            const { _id, role } = user;
            let obj = {};
            obj.id = await aes256.encrypt(encryptedKey, _id.toString());
            obj.role = await aes256.encrypt(encryptedKey, role.toString());
            obj.userId = _id;
            const token = jwt.sign(obj, app.superSecretForAdmin, {
                expiresIn: 60 * 60 * 12
            });
            redis.set(user.id, token);
            return token;
        } catch (e) {
            throw (e)
        }
    }

    async updateUser({ name, gender, phone_number, email, role, roles, password, id }) {
        try {
            const updateData = {
                email,
                phone_number,
                name,
                gender
            };
            if (password && password.trim()) {
                updateData.password = await hashPassword(password)
            }
            if (Array.isArray(roles) && roles.length) {
                updateData.roles = [...new Set(roles)];
                updateData.role = roles[0];
            } else if (role) {
                updateData.role = role;
                updateData.roles = [role];
            }
            return await User.findOneAndUpdate(
                { _id: id },
                { $set: updateData },
                { new: true }
            );
        } catch (e) {
            throw e;
        }
    }
    async updateAccess({ access, id, enquiry, shown_filter, shown_column, google_sheet, sales_contact, lead_source, create_lead, isLeadReminder, is_active, isMarketing, inventory }) {
        try {
            if (!id) {
                throw new Error("User ID is required");
            }
            return await User.findOneAndUpdate({ _id: id }, {
                access,
                enquiry,
                shown_filter,
                shown_column,
                google_sheet,
                sales_contact,
                lead_source,
                create_lead,
                isLeadReminder,
                is_active,
                isMarketing,
                inventory
            });
        } catch (e) {
            throw (e)
        }
    }

    async createUser({ name, gender, phone_number, email, password, role, roles }) {
        try {
            const hashedPassword = await hashPassword(password);
            let finalRoles = [];
            if (Array.isArray(roles) && roles.length) {
                finalRoles = roles;
            } else if (role) {
                finalRoles = [role];
            }
            if (!finalRoles.length) {
                throw new Error('User role is required');
            }
            return await User.create({
                name,
                gender,
                phone_number,
                email,
                password: hashedPassword,
                roles: finalRoles,
                role: finalRoles[0],
            });

        } catch (e) {
            throw e;
        }
    }


    async userList({ limit, skip, orderBy = 1, sortBy = 'name', name, phone_number, dropdown, email, roles }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                name = '.*' + name + '.*';
                condition['name'] = { $regex: new RegExp('^' + name + '$', 'i') };
            }
            if (phone_number) {
                phone_number = '.*' + phone_number + '.*';
                condition['phone_number'] = { $regex: new RegExp('^' + phone_number + '$', 'i') };
            }
            if (email) {
                email = '.*' + email + '.*';
                condition['email'] = { $regex: new RegExp('^' + email + '$', 'i') };
            }
            if (roles === 'sales') {
                condition.$or = [
                    { role: 'sales' },
                    { roles: { $in: ['sales'] } }
                ];

                result.users = await User.find(condition)
                    .limit(limit)
                    .skip(skip)
                    .sort({ createdAt: -1 });
            }
            if (roles === 'vendor') {
                condition['role'] = 'vendor';
                condition['is_mobile_verified'] = true;
                result.users = await User.find(condition)
                    .limit(limit)
                    .skip(skip)
                    .sort({
                        createdAt: -1
                    });
            }
            if (dropdown) {
                result.users = await User.find(condition)
                    .sort({
                        createdAt: -1
                    });
            }
            result.count = await User.countDocuments(condition);
            return result;
        } catch (e) {
            throw (e)
        }
    }
    async userData({ id }) {
        try {
            let result = {}
            result.user = await User.findById(id)
            return result;
        } catch (e) {
            throw (e)
        }
    }

    async deleteUser({ userId }) {
        try {
            await User.deleteOne({ _id: userId });
            return true;
        } catch (error) {
            throw (error)
        }
    }

    async deleteUserByPhoneNumber({ mobile }) {
        try {
            await User.deleteOne({ phone_number: mobile });
            return true;
        } catch (error) {
            throw (error)
        }
    }

    async forgotPwd({ password, phone_number, email }) {
        try {
            if (!password) {
                this._throwException('Password is required');
            }
            const hashedPassword = await hashPassword(password);
            const condition = {};
            if (phone_number) condition.phone_number = phone_number;
            if (email) condition.email = email;
            condition.$or = [
                { role: { $in: ['admin', 'sales'] } },
                { roles: { $in: ['admin', 'sales'] } }
            ]
            const user = await User.findOne(condition);

            if (!user) {
                this._throwException('User does not exist');
            }
            if (!this.hasAdminAccess(user)) {
                this._throwException("You don't have admin rights.");
            }

            await User.updateOne(
                { _id: user._id },
                { $set: { password: hashedPassword } }
            );

            return true;

        } catch (error) {
            throw error;
        }
    }


    async sendOTP({ phone_number, dial_code, email, admin_email }) {
        try {
            // 🔹 Build query
            const condition = {};
            if (email) condition.email = email;
            if (phone_number) condition.phone_number = phone_number;
            condition.$or = [
                { role: { $in: ['admin', 'sales'] } },
                { roles: { $in: ['admin', 'sales'] } }
            ]
            const user = await User.findOne(condition);

            if (!user) {
                this._throwException('Oops! user does not exist');
            }
            if (!this.hasAdminAccess(user)) {
                this._throwException("You don't have admin rights.");
            }
            const otp = this._randomCodeGenerator();

            await User.updateOne(
                { _id: user._id },
                { $set: { otp } }
            );
            if (email) {
                const mailPayload = {
                    toEmails: [admin_email || user.email],
                    templateName: 'otp',
                    htmlVariables: { otp },
                    subjectVariables: { name: user.name },
                    bccAddresses: [],
                    ccAddresses: []
                };

                const result = await aws.sendMail(mailPayload);

                return {
                    result,
                    message: 'OTP sent successfully.'
                };
            }
            if (phone_number) {
                const formattedPhone = dial_code
                    ? `${dial_code}${phone_number}`
                    : `+91${phone_number}`;

                const result = await messageService.sendOTP(
                    formattedPhone,
                    otp,
                    dial_code
                );

                return {
                    result,
                    message: 'OTP sent successfully.'
                };
            }

        } catch (error) {
            throw error;
        }
    }


    async validateUser({ phone_number, otp, email }) {
        try {
            let user;
            if (phone_number) {
                user = await User.findOne({ phone_number });
            } else if (email) {
                user = await User.findOne({ email });
            }
            if (!user) {
                this._throwException('Oops! user does not exist');
            }
            if (!this.hasAdminAccess(user)) {
                this._throwException("You don't have admin rights.");
            }
            if (user.otp !== +otp) {
                this._throwException('OTP mismatched!!');
            }
            const updateData = {
                otp: '',
            };

            if (phone_number) {
                updateData.is_mobile_verified = true;
            }

            if (email) {
                updateData.is_email_verified = true;
            }

            await User.findByIdAndUpdate(user._id, updateData, { new: true });

            return {
                user,
                message: 'OTP verified successfully'
            };

        } catch (error) {
            throw error;
        }
    }


    _throwException(message) {
        throw ({
            name: "cofynd",
            code: 401,
            message
        })
    }

    _randomCodeGenerator() {
        return Math.floor(1000 + Math.random() * 9000);
    }
}

export default new AdminAuthService();