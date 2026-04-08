import models from '../../models/index.js';
const ColivingPlans = models['ColivingPlans'];

class ManageColivingPlansService {
    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
        return {
            getColivingPlans: this.getColivingPlans.bind(this),
            getColivingPlansById: this.getColivingPlansById.bind(this),
            getColivingPlansByName: this.getColivingPlansByName.bind(this),
            addColivingPlans: this.addColivingPlans.bind(this),
            updateColivingPlans: this.updateColivingPlans.bind(this),
            toggleColivingPlansStatus: this.toggleColivingPlansStatus.bind(this),
            deleteColivingPlans: this.deleteColivingPlans.bind(this),
            getActiveColivingPlans: this.getActiveColivingPlans.bind(this)
        }
    }

    async getColivingPlans({ limit, skip, orderBy = 1, sortBy = 'name', name, dropdown }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                name = '.*' + name + '.*';
                condition['name'] = { $regex: new RegExp('^' + name + '$', 'i') };
            }
            if (dropdown) {
                result.states = await ColivingPlans.find(condition)
                    .sort({
                        [sortBy]: orderBy
                    });
            } else {
                result.states = await ColivingPlans.find(condition)
                    .populate('icons')
                    .limit(limit)
                    .skip(skip)
                    .sort({
                        [sortBy]: orderBy
                    });
            }
            result.count = await ColivingPlans.countDocuments(condition);
            return result;
        } catch (e) {
            throw (e)
        }
    }

    async getColivingPlansById({ id }) {
        try {
            const state = await ColivingPlans.findOne({ _id: id });
            return state;
        } catch (error) {
            throw (error);
        }
    }

    async getActiveColivingPlans({}) {
        try {
            const state = await ColivingPlans.find({ active: true });
            return state;
        } catch (error) {
            throw (error);
        }
    }

    async getColivingPlansByName({ stateName }) {
        try {
            let findName = '.*' + stateName + '.*';
            findName = { $regex: new RegExp('^' + stateName + '$', 'i') };
            const state = await ColivingPlans.findOne({ name: findName });
            return state;
        } catch (error) {
            throw (error);
        }
    }

    async addColivingPlans({ name, description, country, icons }) {
        try {
            const state = await ColivingPlans.create({ name, description, country, icons });
            return state;
        } catch (e) {
            throw (e)
        }
    }

    async updateColivingPlans({ categoryId, name, description, country, icons }) {
        try {
            return await ColivingPlans.findOneAndUpdate({ _id: categoryId }, { name, description, country, icons }, { new: true });
        } catch (e) {
            throw (e)
        }
    }

    async toggleColivingPlansStatus({ categoryId }) {
        try {
            const stateStatus = await ColivingPlans.findOne({ _id: categoryId });
            const state = await ColivingPlans.findByIdAndUpdate({ _id: categoryId }, { active: !stateStatus.active }, this.updateOptions);
            return state;
        } catch (e) {
            throw (e)
        }
    }
    async deleteColivingPlans({ categoryId }) {
        try {
            await ColivingPlans.deleteOne({ _id: categoryId });
            return true;
        } catch (error) {
            throw (error)
        }
    }
}

export default new ManageColivingPlansService();