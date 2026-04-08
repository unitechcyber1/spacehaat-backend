import models from '../../models/index.js';
const FlatPlans = models['FlatPlans'];
class ManageFlatPlansService {
    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
        return {
            getFlatPlans: this.getFlatPlans.bind(this),
            getFlatPlansById: this.getFlatPlansById.bind(this),
            getFlatPlansByName: this.getFlatPlansByName.bind(this),
            addFlatPlans: this.addFlatPlans.bind(this),
            updateFlatPlans: this.updateFlatPlans.bind(this),
            toggleFlatPlansStatus: this.toggleFlatPlansStatus.bind(this),
            deleteFlatPlans: this.deleteFlatPlans.bind(this),
            getActiveFlatPlans: this.getActiveFlatPlans.bind(this)
        }
    }

    async getFlatPlans({ limit, skip, orderBy = 1, sortBy = 'name', name, dropdown }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                name = '.*' + name + '.*';
                condition['name'] = { $regex: new RegExp('^' + name + '$', 'i') };
            }
            if (dropdown) {
                result.states = await FlatPlans.find(condition)
                    .sort({
                        [sortBy]: orderBy
                    });
            } else {
                result.states = await FlatPlans.find(condition)
                    .populate('icons')
                    .limit(limit)
                    .skip(skip)
                    .sort({
                        [sortBy]: orderBy
                    });
            }
            result.count = await FlatPlans.countDocuments(condition);
            return result;
        } catch (e) {
            throw (e)
        }
    }

    async getFlatPlansById({ id }) {
        try {
            const state = await FlatPlans.findOne({ _id: id });
            return state;
        } catch (error) {
            throw (error);
        }
    }

    async getActiveFlatPlans({}) {
        try {
            const state = await FlatPlans.find({ active: true });
            return state;
        } catch (error) {
            throw (error);
        }
    }

    async getFlatPlansByName({ stateName }) {
        try {
            let findName = '.*' + stateName + '.*';
            findName = { $regex: new RegExp('^' + stateName + '$', 'i') };
            const state = await FlatPlans.findOne({ name: findName });
            return state;
        } catch (error) {
            throw (error);
        }
    }

    async addFlatPlans({ name, description, country, icons }) {
        try {
            const state = await FlatPlans.create({ name, description, country, icons });
            return state;
        } catch (e) {
            throw (e)
        }
    }

    async updateFlatPlans({ categoryId, name, description, country, icons }) {
        try {
            return await FlatPlans.findOneAndUpdate({ _id: categoryId }, { name, description, country, icons }, { new: true });
        } catch (e) {
            throw (e)
        }
    }

    async toggleFlatPlansStatus({ categoryId }) {
        try {
            const stateStatus = await FlatPlans.findOne({ _id: categoryId });
            const state = await FlatPlans.findByIdAndUpdate({ _id: categoryId }, { active: !stateStatus.active }, this.updateOptions);
            return state;
        } catch (e) {
            throw (e)
        }
    }
    async deleteFlatPlans({ categoryId }) {
        try {
            await FlatPlans.deleteOne({ _id: categoryId });
            return true;
        } catch (error) {
            throw (error)
        }
    }
}

export default new ManageFlatPlansService();