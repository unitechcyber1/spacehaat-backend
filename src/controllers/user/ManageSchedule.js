import manageScheduleService from '../../services/user/manage-schedule.js';

class ManageSchedule {
    constructor() {
        return {
            getSchedules: this.getSchedules.bind(this),
            getScheduleById: this.getScheduleById.bind(this),
            createSchedule: this.createSchedule.bind(this)
        }
    }

    async getSchedules(req, res, next) {
        try {
            const result = await manageScheduleService.getSchedules(req.query, req.user);
            res.status(200).json({
                message: 'get schedule list',
                data: result
            })
        } catch (error) {
            next(error);
        }
    }

    async getScheduleById(req, res, next) {
        try {
            const schedule = await manageScheduleService.getScheduleById(req.params, req.user);
            res.status(200).json({
                message: 'get schedule by id',
                data: schedule
            })
        } catch (error) {
            next(error);
        }
    }

    async createSchedule(req, res, next) {
        try {
            const object = Object.assign({}, req.body, req.user)
            const schedule = await manageScheduleService.createSchedule(object);
            res.status(200).json({
                message: 'schedule created',
                data: schedule
            })
        } catch (error) {
            next(error);
        }
    }
}

export default new ManageSchedule();