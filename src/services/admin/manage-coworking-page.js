import models from '../../models/index.js';
const Coworking = models['Coworking'];

class ManageCoworkingPageService {

    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };

        return {
            getCoworkingPageById: this.getCoworkingPageById.bind(this),
            createCoworkingPage: this.createCoworkingPage.bind(this),
            updateCoworkingPage: this.updateCoworkingPage.bind(this),
        }

    }

    async getCoworkingPageById({ workSpaceId }) {
        try {
            const CoworkingDetails = await Coworking.findOne({ _id: workSpaceId })
                .populate('image')
                .populate('country')
                .populate('amenities.icon')
                .populate('cofynd_advantages.advantage_steps.icon')
                .populate('customize_solutions.solution_steps.icon')
                .populate('exclusive_cofynd.image')
                .populate('list_your_space.background_image')
                .populate('list_your_space.image')
            return CoworkingDetails;
        } catch (error) {
            throw error;
        }
    }

    async createCoworkingPage({
        name,
        country,
        page_heading,
        image,
        amenities,
        booking_steps,
        cofynd_advantages,
        customize_solutions,
        exclusive_cofynd,
        list_your_space,
        questions,
    }) {
        try {
            return await Coworking.create({
                name,
                country,
                page_heading,
                image,
                amenities,
                booking_steps,
                cofynd_advantages,
                customize_solutions,
                exclusive_cofynd,
                list_your_space,
                questions,
            })
        } catch (error) {
            throw error;
        }
    }

    async updateCoworkingPage({
        id,
        name,
        country,
        page_heading,
        image,
        amenities,
        booking_steps,
        cofynd_advantages,
        customize_solutions,
        exclusive_cofynd,
        list_your_space,
        questions,
    }) {
        try {
            return await Coworking.findOneAndUpdate({ _id: id }, {
                name,
                country,
                page_heading,
                image,
                amenities,
                booking_steps,
                cofynd_advantages,
                customize_solutions,
                exclusive_cofynd,
                list_your_space,
                questions,
            })
        } catch (error) {
            throw error;
        }
    }

}

export default new ManageCoworkingPageService();