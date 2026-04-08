import manageUserService from '../../services/user/manage-user.js';

class ManageUser {
    constructor() {
        return {
            updateUser: this.updateUser.bind(this),
            likeOrDislikeWorkSpace: this.likeOrDislikeWorkSpace.bind(this),
            getFavouriteByUser: this.getFavouriteByUser.bind(this),
            getProfile: this.getProfile.bind(this),
            vendorProfile: this.vendorProfile.bind(this),
            updateVendor: this.updateVendor.bind(this),
            vendorDetails: this.vendorDetails.bind(this)
        }
    }

    async updateUser(req, res, next) {
        try {
            const object = Object.assign({}, req.body, req.user)
            const result = await manageUserService.updateUser(object);
            res.status(200).json({
                message: 'User detail updated',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async updateVendor(req, res, next) {
        try {
            const object = Object.assign({}, req.body, req.user)
            const result = await manageUserService.updateVendor(object);
            res.status(200).json({
                message: 'User detail updated',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async likeOrDislikeWorkSpace(req, res, next) {
        try {
            const result = await manageUserService.likeOrDislikeWorkSpace(req.body, req.user);
            res.status(200).json({
                message: 'WorkSpace like or dislike updated',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async getFavouriteByUser(req, res, next) {
        try {
            const result = await manageUserService.getFavouriteByUser(req.user);
            res.status(200).json({
                message: 'WorkSpace list',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async getProfile(req, res, next) {
        try {
            const result = await manageUserService.getProfile(req.user);
            res.status(200).json({
                message: 'get Profile',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async vendorProfile(req, res, next) {
        try {
            const result = await manageUserService.vendorProfile(req.query.id);
            res.status(200).json({
                message: 'get Profile',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async vendorDetails(req, res, next) {
        try {
            const result = await manageUserService.vendorDetails(req.query.phone_number);
            res.status(200).json({
                message: 'get Profile',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }
}

export default new ManageUser();