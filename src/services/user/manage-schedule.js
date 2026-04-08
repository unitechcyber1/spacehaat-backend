import models from '../../models/index.js';
const Schedule = models['Schedule'];

class ManageScheduleService {
    constructor() {
        return {
            getSchedules: this.getSchedules.bind(this),
            getScheduleById: this.getScheduleById.bind(this),
            createSchedule: this.createSchedule.bind(this),
        }
    }

    async createSchedule(
        {
            name,
            email,
            phone_number,
            visit_date,
            no_of_person,
            interested_in,
            message,
            work_space
        },
        { id: user }
    ) {
        try {
            const schedule = await Schedule.create({
                name,
                email,
                phone_number,
                visit_date,
                no_of_person,
                interested_in,
                message,
                work_space,
                user
            });
            return schedule;
        } catch (error) {
            throw (error);
        }
    }

    async getScheduleById({ id }, { user }) {
        try {
            const schedule = await Schedule.findOne({ _id: id, user: user.id });
            return schedule;
        } catch (error) {
            throw (error);
        }
    }

    async getSchedules({ limit, skip, orderBy = 1, sortBy = 'name' }, { user }) {
        try {
            const result = {};
            result.schedules = await Schedule.find({ user: user.id })
                .limit(limit)
                .skip(skip)
                .sort({ [sortBy]: orderBy });
            result.count = await Schedule.countDocuments({ user: user.id });
            return result;
        } catch (error) {
            throw (error);
        }
    }
}

export default new ManageScheduleService()