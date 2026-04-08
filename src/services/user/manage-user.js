import models from '../../models/index.js';
const User = models['User'];
const WorkSpace = models['WorkSpace'];
const Enquiry = models['Enquiry'];

class ManageUserService {
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

    async updateUser({ id, name, email, gender, dob }) {
        try {
            const user = await User.findOneAndUpdate({ _id: id }, { name, email, gender, dob }, { new: true })
            return user;
        } catch (error) {
            throw (error);
        }
    }

    async updateVendor({ id, name, email, phone_number, profile_pic, country, state, city, postal_code, Bio }) {
        try {
            const user = await User.findOneAndUpdate({ _id: id }, { name, email, phone_number, profile_pic, country, state, city, postal_code, Bio }, { new: true })
            return user;
        } catch (error) {
            throw (error);
        }
    }

    async likeOrDislikeWorkSpace({ workSpaceId, is_interested }, { id: userId }) {
        try {
            const likedWorkSpace = await WorkSpace.findOne({ _id: workSpaceId, likes: userId });
            if (is_interested && likedWorkSpace) {
                this._throwException(`Already liked this workspace`);
            }
            if (!is_interested && !likedWorkSpace) {
                this._throwException(`Already disliked this workspace`);
            }
            if (!is_interested && likedWorkSpace) {
                return await WorkSpace.findOneAndUpdate({ _id: workSpaceId, likes: userId }, { $pull: { 'likes': userId } }, { new: true })
            }
            return await WorkSpace.findOneAndUpdate({ _id: workSpaceId }, { $push: { 'likes': userId } }, { new: true })
        } catch (error) {
            throw (error);
        }
    }

    async getFavouriteByUser({ id: userId }) {
        try {
            const result = await WorkSpace.find({ 'likes': userId }).populate('images.image');
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async getProfile({ id: userId }) {
        try {
            const user = await User.find({ _id: userId });
            return user;
        } catch (error) {
            throw (error);
        }
    }

    async vendorProfile(id) {
        try {
            const user = await User.findOne({ _id: id }).populate('profile_pic');
            return user;
        } catch (error) {
            throw (error);
        }
    }

    async vendorDetails(phone_number) {
        try {
            const user = await User.findOne({ phone_number: phone_number }).populate('profile_pic');
            return user;
        } catch (error) {
            throw (error);
        }
    }

    _throwException(message) {
        throw ({
            name: "cofynd",
            code: 400,
            message
        })
    }
}

export default new ManageUserService();