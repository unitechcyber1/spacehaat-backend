import auth from '../../services/user/auth-service.js';
import redis from '../../utilities/redis.js';
import aws from '../../utilities/aws.js';
import app from '../../config/app.js';
import axios from 'axios';

class AdminAuth {
    constructor() {
        this.axiosConfig = {
            headers: {
                'Content-Type': 'application/json'
            }
        }
        return {
            login: this.login.bind(this),
            vendorLogin: this.vendorLogin.bind(this),
            signUpUser: this.signUpUser.bind(this),
            validateUser: this.validateUser.bind(this),
            validateVendorUser: this.validateVendorUser.bind(this),
            resendOTP: this.resendOTP.bind(this),
            logout: this.logout.bind(this),
            createUser: this.createUser.bind(this),
            vendorSignUp: this.vendorSignUp.bind(this),
            manageUser: this.manageUser.bind(this),
            updateUser: this.updateUser.bind(this)
        }
    }

    async signUpUser(req, res, next) {
        try {
            const user = await auth.signUpUser(req.body);
            const token = await auth.createToken(user);
            let obj = {
                toEmails: [user.email],
                templateName: 'welcome',
                htmlVariables: { name: user.name.toUpperCase() },
                bccAddresses: [],
                ccAddresses: []
            }
            // await aws.sendMail(obj);
            return res.status(200).json({
                message: 'user information updated',
                data: user,
                token
            });
        } catch (error) {
            next(error)
        }
    }

    async vendorSignUp(req, res, next) {
        try {
            const user = await auth.vendorSignUpUser(req.body);
            const token = await auth.createVendorTokenForRegister(user);
            let date = new Date();
            const options = { year: 'numeric', month: 'long', day: 'numeric' };

            //send mail to admin when new user registered...
            let obj = {
                toEmails: [app.listingEmail],
                templateName: 'user_registered',
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

            // *** send revert mail to user when new user register with cofynd *** // 
            // let obj1 = {
            //     toEmails: [user.email],
            //     templateName: 'welcome',
            //     htmlVariables: { name: user.name.toUpperCase() },
            //     bccAddresses: [],
            //     ccAddresses: []
            // }
            // await aws.sendMail(obj1);

            // *** send user data to leadsqueared *** //
            // const body = this.sanitozeRequestBody({ user });
            // await this.leadSquadApiCall(body);

            return res.status(200).json({
                message: 'user information updated',
                data: user,
                token
            });
        } catch (error) {
            next(error)
        }
    }

    sanitozeRequestBody({
        user,
        source = "Organic",
    }) {
        try {
            const resposne = [{
                "Attribute": "EmailAddress",
                "Value": user.email || '1test@qwert12.com'
            },
            {
                "Attribute": "FirstName",
                "Value": user.name || 'No Name'
            },
            {
                "Attribute": "Phone",
                "Value": user.phone_number || '9715876567'
            },
            {
                "Attribute": "mx_visitDate",
                "Value": new Date() || null
            },
            {
                "Attribute": "Source",
                "Value": source
            }
            ];
            return resposne;
        } catch (error) {
            throw (error);
        }
    }

    async leadSquadApiCall(body) {
        try {
            let lead_id = null;
            const response = await axios.post(
                `${app.leadSquaredUrl}LeadManagement.svc/Lead.Capture?accessKey=${app.leadSquaredAccessToken}&secretKey=${app.leadSquaredSecretKey}`,
                body,
                this.axiosConfig
            );
            if (response.data && response.data.Status === 'Success') {
                lead_id = response.data.Message.Id;
            }
            return lead_id;
        } catch (error) {
            console.log(error);
        }
    }

    async login(req, res, next) {
        try {
            const user = await auth.authenticate(req.body);
            return res.status(200).json({
                message: 'otp send to the user cellphone',
                data: user
            });
        } catch (e) {
            next(e)
        }
    }

    async vendorLogin(req, res, next) {
        try {
            const user = await auth.authenticateVendor(req.body);
            return res.status(200).json({
                message: 'otp send to the user cellphone',
                data: user
            });
        } catch (e) {
            next(e)
        }
    }

    async logout(req, res, next) {
        try {
            const { id: userId } = req.user;
            await redis.delete(userId);
            return res.status(200).json({
                message: 'Successfully logged Out'
            });
        } catch (error) {
            next(error);
        }
    }

    async validateUser(req, res, next) {
        try {
            let token = null;
            let result = await auth.validateUser(req.body);
            if (result.user && result.user.is_profile_updated) {
                token = await auth.createToken(result.user);
            }
            return res.status(200).json({
                message: result.message,
                token,
                data: result.user
            });
        } catch (e) {
            next(e)
        }
    }

    async validateVendorUser(req, res, next) {
        try {
            let token = null;
            let result = await auth.validateUser(req.body);
            if (result.user && result.user.is_profile_updated) {
                token = await auth.createVendorToken(result.user);
            }
            return res.status(200).json({
                message: result.message,
                token,
                data: result.user
            });
        } catch (e) {
            next(e)
        }
    }


    async resendOTP(req, res, next) {
        try {
            const result = await auth.resendOTP(req.body);
            return res.status(200).json({
                message: result.message
            });
        } catch (error) {
            next(error);
        }
    }

    async createUser(req, res, next) {
        try {
            const result = await auth.createUser(req.body);
            return res.status(200).json({
                message: result.message,
                data: result
            });
        } catch (error) {
            next(error);
        }
    }
    async updateUser(req, res, next) {
        try {
            const admin = await auth.updateUser(req.body);
            return res.status(200).json({
                message: 'user credit updated',
                data: admin
            })
        } catch (error) {
            next(error)
        }
    }

    async manageUser(req, res, next) {
        try {
            if (req.body.type === 'delete') {
                const result = await auth.deleteUserByMobile(req.body);
                return res.status(200).json({
                    message: 'Success',
                    data: result
                });
            } else {
                const result = await auth.findUserByMobile(req.body);
                return res.status(200).json({
                    message: 'Success',
                    data: result
                });
            }
        } catch (error) {
            next(error);
        }
    }
}

export default new AdminAuth();