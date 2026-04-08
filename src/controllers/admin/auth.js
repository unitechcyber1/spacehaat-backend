import auth from '../../services/admin/auth.js';
import redis from '../../utilities/redis.js';

class AdminAuth {
    constructor() {
        return {
            login: this.login.bind(this),
            createAdmin: this.createAdmin.bind(this),
            logout: this.logout.bind(this),
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

    async createAdmin(req, res, next) {
        try {
            const admin = await auth.createUser(req.body);
            admin.password = undefined;
            return res.status(200).json({
                message: 'admin create',
                data: admin
            })
        } catch (error) {
            next(error)
        }
    }
    async welcomeMessage(req, res, next){
        try {
            const msg = await auth.welcomeMessage(req.body);
            return res.status(200).json({
                message: 'Message Sent',
                data: msg
            })
        } catch (error) {
            next(error)
        }
    }
    async updateUser(req, res, next) {
        try {
            const admin = await auth.updateUser(req.body);
            return res.status(200).json({
                message: 'user updated',
                data: admin
            })
        } catch (error) {
            next(error)
        }
    }
    async updateAccess(req, res, next) {
        try {
            const admin = await auth.updateAccess(req.body);
            return res.status(200).json({
                message: 'Access updated',
                data: admin
            })
        } catch (error) {
            next(error)
        }
    }

    async login(req, res, next) {
        try {
            let user = await auth.authenticate(req.body);
            let token = await auth.createToken(user);
            user.password = undefined;
            return res.status(200).json({
                token: token,
                role: user.role,
                user
            });
        } catch (e) {
            next(e)
        }
    }

    async logout(req, res, next) {
        try {
            const { id: adminId } = req.admin;
            await redis.delete(adminId);
            return res.status(200).json({
                message: 'Successfully logged Out'
            });
        } catch (error) {
            next(error);
        }
    }

    async userList(req, res, next) {
        try {
            const result = await auth.userList(req.query);
            return res.status(200).json({
                message: "User List",
                data: result.users,
                totalRecords: result.count
            })
        } catch (e) {
            next(e)
        }
    }
    async userData(req, res, next) {
        try {
            const result = await auth.userData(req.params);
            return res.status(200).json({
                message: "User",
                data: result.user
            })
        } catch (e) {
            next(e)
        }
    }

    async deleteUser(req, res, next) {
        try {
            await auth.deleteUser(req.params);
            res.status(200).json({
                message: 'user deleted'
            })
        } catch (error) {
            next(error);
        }
    }

    async deleteUserByPhoneNumber(req, res, next) {
        try {
            await auth.deleteUserByPhoneNumber(req.params);
            res.status(200).json({
                message: 'user deleted'
            })
        } catch (error) {
            next(error);
        }
    }

    async forgotPwd(req, res, next) {
        try {
            await auth.forgotPwd(req.body);
            res.status(200).json({
                message: 'Admin pwd changed',
            })
        } catch (error) {
            next(error);
        }
    }

    async sendOTP(req, res, next) {
        try {
            const result = await auth.sendOTP(req.body);
            return res.status(200).json({
                message: result.message
            });
        } catch (error) {
            next(error);
        }
    }

    async validateUser(req, res, next) {
        try {
            let result = await auth.validateUser(req.body);
            return res.status(200).json({
                message: result.message,
                data: result.user
            });
        } catch (e) {
            next(e)
        }
    }

}

export default new AdminAuth();