import models from '../../models/index.js';
const Schedule = models['Schedule'];

class ManageScheduleService {
    constructor() {
        return {
            updateSchedule: this.updateSchedule.bind(this),
            getScheduleById: this.getScheduleById.bind(this),
            getSchedules: this.getSchedules.bind(this)
        }
    }

    async updateSchedule({ id, status, visit_date, message }, { admin }) {
        try {
            if (status !== 're_arrange') {
                return await Schedule.findOneAndUpdate({ _id: id }, { status, updated_by: admin.id, message }, { new: true })
            } else {
                return await Schedule.findOneAndUpdate({ _id: id }, { status, visit_date, message, updated_by: admin.id }, { new: true })
            }
        } catch (error) {
            throw (error);
        }
    }

    async getScheduleById({ id }) {
        try {
            const schedule = await Schedule.findOne({ _id: id });
            return schedule;
        } catch (error) {
            throw (error);
        }
    }

    async getSchedules({ limit, skip, orderBy = 1, sortBy = 'name' }) {
        try {
            const result = {};
            result.schedules = await Schedule.find({})
                .limit(limit)
                .skip(skip)
                .sort({
                    [sortBy]: orderBy });
            result.count = await Schedule.countDocuments();
            return result;
        } catch (error) {
            throw (error);
        }
    }

    _throwException(message) {
        throw ({
            name: "cofynd",
            code: 401,
            message
        })
    }
}

export default new ManageScheduleService()