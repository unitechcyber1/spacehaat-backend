import models from '../../models/index.js';
import _ from 'lodash';
const MicroLocation = models['MicroLocation'];


class ManageMicroLocationService {
    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
        return {
            getMicroLocations: this.getMicroLocations.bind(this),
            getMicroLocationById: this.getMicroLocationById.bind(this),
            getMicroLocationByCity: this.getMicroLocationByCity.bind(this),
            getMicroLocationByName: this.getMicroLocationByName.bind(this),
            addMicroLocation: this.addMicroLocation.bind(this),
            updateMicroLocation: this.updateMicroLocation.bind(this),
            toggleMicroLocationStatus: this.toggleMicroLocationStatus.bind(this),
            microLocationByCityAndSpaceType: this.microLocationByCityAndSpaceType.bind(this),
            deleteMicroLocation: this.deleteMicroLocation.bind(this),
            _createDynamicPriorityType: this._createDynamicPriorityType.bind(this),
            setPriorityByType: this.setPriorityByType.bind(this),
            getPriorityMicrolocations: this.getPriorityMicrolocations.bind(this),
            addPriorityMicrolocations: this.addPriorityMicrolocations.bind(this),
            locationOrderByDrag: this.locationOrderByDrag.bind(this)
        }
    }

    async getMicroLocations({ limit, skip, orderBy = 1, sortBy = 'name', name,for_coworking, for_office, for_buildings, for_coliving, for_flat,city, dropdown }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                name = '.*' + name + '.*';
                condition['name'] = { $regex: new RegExp('^' + name + '$', 'i') };
            }
            if (city) {
                condition['city'] = city;
            }
            if (for_coworking) {
                condition['for_coWorking'] = for_coworking;
            }
            if (for_office) {
                condition['for_office'] = for_office;
            }
            if (for_coliving) {
                condition['for_coLiving'] = for_coliving;
            }
            if (for_flat) {
                condition['for_flatspace'] = for_flat;
            }
            if(for_buildings){
                condition['for_buildings'] = for_buildings;
            }
            if (dropdown) {
                result.microLocations = await MicroLocation.find(condition)
                    .sort({
                        [sortBy]: orderBy
                    });
            } else {
                result.microLocations = await MicroLocation.find(condition)
                    .populate('city')
                    .populate('locationImage.coworking')
                    .populate('locationImage.coliving')
                    .populate('locationImage.officespace')
                    .populate('locationImage.buildings')
                    .populate('locationImage.virtualoffice')
                    .limit(limit)
                    .skip(skip)
                    .sort({
                        [sortBy]: orderBy
                    });
            }
            result.count = await MicroLocation.countDocuments(condition);
            return result;
        } catch (e) {
            throw (e)
        }
    }
    async getMicroLocationById({ id }) {
        try {
            const microLocation = await MicroLocation.findOne({ _id: id });
            return microLocation;
        } catch (error) {
            throw (error);
        }
    }

    async getMicroLocationByName({ microLocationName }) {
        try {
            let findName = '.*' + microLocationName + '.*';
            findName = { $regex: new RegExp('^' + microLocationName + '$', 'i') };
            const microLocation = await MicroLocation.findOne({ name: findName });
            return microLocation;
        } catch (error) {
            throw (error);
        }
    }

    async addMicroLocation({ name, latitude, longitude, locationImage, for_flatspace, for_coWorking, for_office, for_coLiving, for_buildings, description, city }) {
        try {
            const microLocation = await MicroLocation.create({ name,latitude, longitude, locationImage,for_flatspace, for_coWorking, for_office, for_coLiving,for_buildings, description, city });
            return microLocation;
        } catch (e) {
            throw (e)
        }
    }
    async updateMicroLocation({ microLocationId, name,latitude, longitude, locationImage, for_flatspace, for_coWorking, for_office, for_coLiving,for_buildings, description, city }) {
        try {
            let updateData = {
                name, latitude, longitude, locationImage, for_flatspace, for_coWorking, for_office, for_coLiving,for_buildings, description, city
            }
            if (!for_coWorking) {
                updateData["priority.for_coworking.is_active"] = false;
                updateData["priority.for_coworking.order"] = 1000;
            }
            if (!for_coLiving) {
                updateData["priority.for_coliving.is_active"] = false;
                updateData["priority.for_coliving.order"] = 1000;
            }
            if (!for_office) {
                updateData["priority.for_office.is_active"] = false;
                updateData["priority.for_office.order"] = 1000;
            }
            if (!for_flatspace) {
                updateData["priority.for_flat.is_active"] = false;
                updateData["priority.for_flat.order"] = 1000;
            }
            if (!for_buildings) {
                updateData["priority.for_buildings.is_active"] = false;
                updateData["priority.for_buildings.order"] = 1000;
            }
            return await MicroLocation.findOneAndUpdate({ _id: microLocationId }, updateData, { new: true });
        } catch (e) {
            throw (e)
        }
    }

    async toggleMicroLocationStatus({ microLocationId }) {
        try {
            const microLocationStatus = await MicroLocation.findOne({ _id: microLocationId });
            const microLocation = await MicroLocation.findByIdAndUpdate({ _id: microLocationId }, { active: !microLocationStatus.active }, this.updateOptions);
            return microLocation;
        } catch (e) {
            throw (e)
        }
    }

    async getMicroLocationByCity({ cityId }) {
        try {
            const microLocations = await MicroLocation.find({ city: cityId });
            return microLocations;
        } catch (error) {
            throw (error);
        }
    }

    async microLocationByCityAndSpaceType({ for_coworking, for_coWorking_city,for_coliving_city, for_office_city, for_office, for_coliving, for_flat, for_buildings, is_admin, cityId, limit = 10, skip, page = 1 }) {
        try {
            let type;
            let sortBy;
            let sortType = 1;
            let condition = {};
            let result = {};
            if (cityId) {
                condition['city'] = cityId;
            }
            if (for_coworking) {
                condition['for_coWorking'] = for_coworking;
                sortBy = 'priority.for_coworking.order';
                type = 'for_coworking';
            }
            // if(for_coWorking_city){
            //     condition['city.for_coWorking'] = true;
            // }
            if (for_office) {
                condition['for_office'] = true;
                sortBy = 'priority.for_office.order';
                type = 'for_office';
            }
            if (for_coliving) {
                condition['for_coLiving'] = true;
                sortBy = 'priority.for_coliving.order';
                type = 'for_coliving';
            }
            if (for_flat) {
                condition['for_flatspace'] = true;
                sortBy = 'priority.for_flat.order';
                type = 'for_flat';
            }
            if(for_buildings){
                condition['for_buildings'] = true;
                sortBy = 'priority.for_buildings.order';
                type = 'for_buildings';
            }
            if (!is_admin) {
                const priorityType = this._createDynamicPriorityType(type) + '.is_active';
                const priorityTypeOrder = this._createDynamicPriorityType(type) + '.order';
                condition[priorityType] = true;
                result.microLocations = await MicroLocation.find(condition)
                .populate("locationImage.coworking")
                .populate("locationImage.coliving")
                .populate("locationImage.officespace")
                .sort({
                    [priorityTypeOrder]: 1
                })
                .populate('city')
                // .skip((page - 1) * limit)
                // .limit(limit) 
                // if(for_coworking){
                //     result.microLocations.sort((a,b) => a.priority.for_coworking.order - b.priority.for_coworking.order)
                // }
                // if(for_coliving){
                //     result.microLocations.sort((a,b) => a.priority.for_coliving.order - b.priority.for_coliving.order)
                // }
                // if(for_office){
                //     result.microLocations.sort((a,b) => a.priority.for_office.order - b.priority.for_office.order)
                // }
                // if(for_flat){
                //     result.microLocations.sort((a,b) => a.priority.for_flat.order - b.priority.for_flat.order)
                // }
                if (for_coworking) {
                    result.microLocations = _.compact(result.microLocations.map(prioritySpace => {
                        if (prioritySpace.priority.for_coworking.city == cityId) {
                            return prioritySpace;
                        }
                    }));
                } else if (for_coliving) {
                    result.microLocations = _.compact(result.microLocations.map(prioritySpace => {
                        if (prioritySpace.priority.for_coliving.city == cityId) {
                            return prioritySpace;
                        }
                    }));
                } else if (for_office) {
                    result.microLocations = _.compact(result.microLocations.map(prioritySpace => {
                        if (prioritySpace.priority.for_office.city == cityId) {
                            return prioritySpace;
                        }
                    }));
                } else if (for_flat) {
                    result.microLocations = _.compact(result.microLocations.map(prioritySpace => {
                        if (prioritySpace.priority.for_flat.city == cityId) {
                            return prioritySpace;
                        }
                    }));
                }
                result.count = await MicroLocation.countDocuments(condition);
                return result;
            } else {
                result.microLocations = await MicroLocation.find(condition)
                .populate('city')
                .sort(sortBy)
                .skip((page - 1) * limit)
                .limit(limit) 
                    if (for_coWorking_city && result.microLocations) {
                        const data = {};
                        data.microLocations = result.microLocations.filter((item) => item.city && item.city.for_coWorking && item.city.for_coWorking === true);
                        return data;
                      }
                      if (for_coliving_city && result.microLocations) {
                        const data = {};
                        data.microLocations = result.microLocations.filter((item) => item.city && item.city.for_coLiving && item.city.for_coLiving === true);
                        return data;
                      }
                      if (for_office_city && result.microLocations) {
                        const data = {};
                        data.microLocations = result.microLocations.filter((item) => item.city && item.city.for_office && item.city.for_office === true);
                        return data;
                      }
                      
                result.count = await MicroLocation.countDocuments(condition);
                return result;
            }
        } catch (error) {
            throw (error);
        }
    }

    async deleteMicroLocation({ microLocationId }) {
        try {
            await MicroLocation.deleteOne({ _id: microLocationId });
            return true;
        } catch (error) {
            throw (error)
        }
    }

    async setPriorityByType({ initialPosition, finalPosition, shiftedId, type }) {
        try {
            const priorityOrder = this._createDynamicPriorityType(type) + '.order';
            const priorityActive = this._createDynamicPriorityType(type) + '.is_active';
            if (initialPosition < finalPosition) {
                await MicroLocation.updateMany({
                    [priorityOrder]: { $lte: finalPosition, $gt: initialPosition },
                    [priorityActive]: true
                }, {
                    $inc: {
                        [priorityOrder]: -1
                    }
                })
                await MicroLocation.updateOne({ _id: shiftedId }, {
                    $set: {
                        [priorityOrder]: finalPosition
                    }
                })
            }
            if (initialPosition > finalPosition) {
                await MicroLocation.updateMany({
                    [priorityOrder]: { $lt: initialPosition, $gte: finalPosition },
                    [priorityActive]: true
                }, {
                    $inc: {
                        [priorityOrder]: 1
                    }
                })
                await MicroLocation.updateOne({ _id: shiftedId }, {
                    $set: {
                        [priorityOrder]: finalPosition
                    }
                })
            }
        } catch (e) {
            throw (e)
        }
    }
    async locationOrderByDrag ({updatedLocations, spaceType}) {
        try {
          for (const project of updatedLocations) {
            const { _id, priority } = project;
            // Find the location by its _id and update its priority order
            if(spaceType === 'for_coliving'){
                await MicroLocation.findByIdAndUpdate(_id, {
                    $set: {
                      "priority.for_coliving.order": priority.for_coliving.order,
                      "priority.for_coliving.is_active": priority.for_coliving.order !== 1000,
                    },
                  });
            }
            if(spaceType === 'for_coworking'){
                await MicroLocation.findByIdAndUpdate(_id, {
                    $set: {
                      "priority.for_coworking.order": priority.for_coworking.order,
                      "priority.for_coworking.is_active": priority.for_coworking.order !== 1000,
                    },
                  });
            }
            if(spaceType === 'for_office'){
                await MicroLocation.findByIdAndUpdate(_id, {
                    $set: {
                      "priority.for_office.order": priority.for_office.order,
                      "priority.for_office.is_active": priority.for_office.order !== 1000,
                    },
                  });
            }
            if(spaceType === 'for_flat'){
                await MicroLocation.findByIdAndUpdate(_id, {
                    $set: {
                      "priority.for_flat.order": priority.for_flat.order,
                      "priority.for_flat.is_active": priority.for_flat.order !== 1000,
                    },
                  });
            }
          }
        } catch (error) {
          console.error("Error updating priority:", error);
        }
      }
    async getPriorityMicrolocations({ type, city }) {
        try {
            let result = {};
            const priorityType = this._createDynamicPriorityType(type) + '.is_active';
            const priorityTypeOrder = this._createDynamicPriorityType(type) + '.order';
            let condition = {
                [priorityType]: true,
                // slug: { $nin: blackListWS }
            };
            result.prioritySpaces = await MicroLocation.find(condition)
                .populate('city')
                .sort({
                    [priorityTypeOrder]: 1
                });
            if (type === 'for_coworking') {
                result.prioritySpaces = _.compact(result.prioritySpaces.map(prioritySpace => {
                    if (prioritySpace.priority.for_coworking.city == city) {
                        return prioritySpace;
                    }
                }));
            } else if (type === 'for_coliving') {
                result.prioritySpaces = _.compact(result.prioritySpaces.map(prioritySpace => {
                    if (prioritySpace.priority.for_coliving.city == city) {
                        return prioritySpace;
                    }
                }));
            } else if (type === 'for_office') {
                result.prioritySpaces = _.compact(result.prioritySpaces.map(prioritySpace => {
                    if (prioritySpace.priority.for_office.city == city) {
                        return prioritySpace;
                    }
                }));
            } else if (type === 'for_flat') {
                result.prioritySpaces = _.compact(result.prioritySpaces.map(prioritySpace => {
                    if (prioritySpace.priority.for_flat.city == city) {
                        return prioritySpace;
                    }
                }));
            }
            result.count = await MicroLocation.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async addPriorityMicrolocations({ id, type, data }) {
        try {
            let object = this._createDynamicPriorityType(type);
            if (!data.is_active) {
                const { priority } = await MicroLocation.findOne({ _id: id }, { priority: 1 });
                const priorityOrder = object + '.order';
                const priorityActive = object + '.is_active';
                const condition = {
                    [priorityOrder]: { $gt: priority[type].order },
                    [priorityActive]: true
                };
                if (data.city) {
                    condition['for_coworking.city'] = data.city;
                    condition['for_coliving.city'] = data.city;
                    condition['for_office.city'] = data.city;
                    condition['for_flat.city'] = data.city;
                }
                await MicroLocation.updateMany(condition, {
                    $inc: {
                        [priorityOrder]: -1
                    }
                });
            }
            await MicroLocation.updateOne({ '_id': id }, {
                $set: {
                    [object]: data
                }
            });
            return true;
        } catch (error) {
            throw (error);
        }
    }

    _createDynamicPriorityType(type) {
        let object = 'priority.overall';
        switch (type) {
            case 'for_coliving':
                object = 'priority.for_coliving';
                break;
            case 'for_coworking':
                object = 'priority.for_coworking';
                break;
            case 'for_office':
                object = 'priority.for_office';
                break;
            case 'for_flat':
                object = 'priority.for_flat';
                break;
            default:
                object = 'priority.overall';
                break;
        }
        return object;
    }
}

export default new ManageMicroLocationService();