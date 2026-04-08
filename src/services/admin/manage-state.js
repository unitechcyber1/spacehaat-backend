import models from '../../models/index.js';
const State = models['State'];
class ManageStateService {
    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
        return {
            getStates: this.getStates.bind(this),
            getStateById: this.getStateById.bind(this),
            getStateByCountry: this.getStateByCountry.bind(this),
            getStateByName: this.getStateByName.bind(this),
            addState: this.addState.bind(this),
            updateState: this.updateState.bind(this),
            toggleStateStatus: this.toggleStateStatus.bind(this),
            deleteState: this.deleteState.bind(this)
        }
    }

    async getStates({ limit, skip, orderBy = 1, sortBy = 'name', name, dropdown }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                name = '.*' + name + '.*';
                condition['name'] = { $regex: new RegExp('^' + name + '$', 'i') };
            }
            if (dropdown) {
                result.states = await State.find(condition)
                    .sort({
                        [sortBy]: orderBy });
            } else {
                result.states = await State.find(condition)
                    .populate('country')
                    .limit(limit)
                    .skip(skip)
                    .sort({
                        [sortBy]: orderBy });
            }
            result.count = await State.countDocuments(condition);
            return result;
        } catch (e) {
            throw (e)
        }
    }

    async getStateById({ id }) {
        try {
            const state = await State.findOne({ _id: id });
            return state;
        } catch (error) {
            throw (error);
        }
    }

    async getStateByName({ stateName }) {
        try {
            let findName = '.*' + stateName + '.*';
            findName = { $regex: new RegExp('^' + stateName + '$', 'i') };
            const state = await State.findOne({ name: findName });
            return state;
        } catch (error) {
            throw (error);
        }
    }

    async addState({ name, for_flatspace, for_coWorking, for_office, for_coLiving, description, country }) {
        try {
            const state = await State.create({ name, for_flatspace, for_coWorking, for_office, for_coLiving, description, country });
            return state;
        } catch (e) {
            throw (e)
        }
    }

    async updateState({ stateId, name, for_flatspace, for_coWorking, for_office, for_coLiving, description, country }) {
        try {
            return await State.findOneAndUpdate({ _id: stateId }, { name, for_flatspace, for_coWorking, for_office, for_coLiving, description, country }, { new: true });
        } catch (e) {
            throw (e)
        }
    }

    async toggleStateStatus({ stateId }) {
        try {
            const stateStatus = await State.findOne({ _id: stateId });
            const state = await State.findByIdAndUpdate({ _id: stateId }, { active: !stateStatus.active }, this.updateOptions);
            return state;
        } catch (e) {
            throw (e)
        }
    }

    async getStateByCountry({ countryId }) {
        try {
            const state = await State.find({ country: countryId });
            return state;
        } catch (error) {
            throw (error);
        }
    }

    async deleteState({ cityId }) {
        try {
            await State.deleteOne({ _id: cityId });
            return true;
        } catch (error) {
            throw (error)
        }
    }
}

export default new ManageStateService();