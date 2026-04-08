import models from "../../models/index.js";

const Amenty = models['Amenty'];
const WorkSpace = models['WorkSpace'];


class ManageAmentyService {
    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
        return {
            getAmenties: this.getAmenties.bind(this),
            addAmenty: this.addAmenty.bind(this),
            editAmenty: this.editAmenty.bind(this),
            deleteAmenty: this.deleteAmenty.bind(this),
            amentyOrderByDrag: this.amentyOrderByDrag.bind(this)
        }
    }

    async getAmenties({ limit, sortBy = 'name', orderBy = 1, skip, name, for_coWorking, for_office, for_coLiving, for_flatspace }) {
        try {
            let result = {};
            let condition = {};
            let sortBy;
            if (name) {
                name = '.*' + name + '.*';
                condition['name'] = { $regex: new RegExp('^' + name + '$', 'i') };
            }
            if(for_flatspace){
                condition['for_flatspace'] = for_flatspace
                sortBy = 'priority.for_flatspace.order'
            }
            if(for_office){
                condition['for_office'] = for_office
                sortBy = 'priority.for_office.order'
            }
            if(for_coWorking){
                condition['for_coWorking'] = for_coWorking
                sortBy = 'priority.for_coWorking.order'
            }
            if(for_coLiving){
                condition['for_coLiving'] = for_coLiving
                sortBy = 'priority.for_coLiving.order'
            }
            result.amenties = await Amenty.find(condition)
                .limit(limit)
                .skip(skip)
                .sort({
                    [sortBy]: 1
                });
            result.count = await Amenty.countDocuments(condition);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async addAmenty({ category, for_flatspace, for_coWorking, for_office, for_coLiving, for_builder_project, name, icon }) {
        try {
            return await Amenty.create({ category, for_flatspace, for_coWorking, for_office, for_coLiving, for_builder_project, name, icon });
        } catch (error) {
            throw error;
        }
    }

    async editAmenty({ amentyId, name, for_flatspace, for_coWorking, for_office, for_coLiving, for_builder_project, category, icon, updated_by }) {
        try {
            return await Amenty.findOneAndUpdate({ _id: amentyId }, { name, for_flatspace, for_coWorking, for_office, for_coLiving, for_builder_project, category, icon, updated_by },
                this.updateOptions);
        } catch (e) {
            throw (e)
        }
    }

    async deleteAmenty({ amentyId }) {
        try {
            const countAmenty = await WorkSpace.countDocuments({ amenties: amentyId });
            if (countAmenty > 0) {
                throw ({
                    name: 'PPP',
                    code: 400,
                    message: 'Can not delete Amenty,Its exists in Work Space'
                })
            }
            await Amenty.deleteOne({ _id: amentyId });
            return true;
        } catch (error) {
            throw (error)
        }
    }
    async amentyOrderByDrag ({updatedAmenty, type}) {
        try {
          for (const project of updatedAmenty) {
            const { _id, priority } = project;
            if(type === 'for_flatspace'){
                await Amenty.findByIdAndUpdate(_id, {
                    $set: {
                      "priority.for_flatspace.order": priority.for_flatspace.order,
                    },
                  });
            }
            if(type === 'for_office'){
                await Amenty.findByIdAndUpdate(_id, {
                    $set: {
                      "priority.for_office.order": priority.for_office.order,
                    },
                  });
            }
            if(type === 'for_coWorking'){
                await Amenty.findByIdAndUpdate(_id, {
                    $set: {
                      "priority.for_coWorking.order": priority.for_coWorking.order,
                    },
                  });
            }
            if(type === 'for_coLiving'){
                await Amenty.findByIdAndUpdate(_id, {
                    $set: {
                      "priority.for_coLiving.order": priority.for_coLiving.order,
                    },
                  });
            }
          }
        } catch (error) {
          throw error
        }
    }
}

export default new ManageAmentyService();