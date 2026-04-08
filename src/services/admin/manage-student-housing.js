import models from '../../models/index.js';
import manageWorkSpaceService from './manage-work-space.js';
import crypto from 'crypto';
import FileUtility from '../../utilities/file.js';
import FileUpload from '../../controllers/common/fileUpload.js'
const StudentHousing = models['StudentHousing'];
const Image = models['Image'];
class ManageStudentHousingSpaceService {
    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
        return {
            getStudentHousingSpaces: this.getStudentHousingSpaces.bind(this),
            getStudentHousingSpaceById: this.getStudentHousingSpaceById.bind(this),
            createStudentHousingSpace: this.createStudentHousingSpace.bind(this),
            updateStudentHousingSpace: this.updateStudentHousingSpace.bind(this),
            addPriorityStudentHousingSpace: this.addPriorityStudentHousingSpace.bind(this),
            setPriorityByType: this.setPriorityByType.bind(this),
            changeStudentHousingSpaceStatus: this.changeStudentHousingSpaceStatus.bind(this),
            deleteStudentHousingSpace: this.deleteStudentHousingSpace.bind(this),
            changeSlugById: this.changeSlugById.bind(this)
        }
    }

    async getStudentHousingSpaces({ limit = 10, sortBy = 'name', orderBy = 1, skip, name, city, location, micro_location, shouldApprove = false }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                /** TODO $text search will be implemented */
                name = name.replace(/[^A-Za-z0-9 ]/g, "");
                condition['name'] = { '$regex': `^(\s+${name}|^${name})`, '$options': 'i' };
            }
            if (city) {
                condition['location.city'] = city;
            }
            if (micro_location) {
                condition['location.micro_location'] = micro_location;
            }
            if (location) {
                location = '.*' + location + '.*';
                condition['location.name'] = { $regex: new RegExp('^' + location + '$', 'i') };
            }
            if (shouldApprove) {
                condition['status'] = 'approve';
                condition['is_active'] = true;
            }
            result.StudentHousings = await StudentHousing.find(condition)
                .populate('location.city')
                .limit(limit)
                .skip(skip)
                .sort({
                    [sortBy]: orderBy
                });
            result.count = await StudentHousing.countDocuments(condition);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async getStudentHousingSpaceById({ StudentHousingSpaceId }) {
        try {
            const StudentHousings = await StudentHousing.findOne({ _id: StudentHousingSpaceId })
                .populate('amenties')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image');
            return StudentHousings;
        } catch (error) {
            throw error;
        }
    }

    async createStudentHousingSpace({
        name,
        description,
        images,
        amenties,
        other_detail,
        social_media,
        location,
        hours_of_operation,
        seo,
        price,
        brand
    }) {
        try {
            const geometry = this._setGeoLocation(location);
            const slug = await this._createSlug(null, name, location.name)
            return await StudentHousing.create({
                name,
                description,
                images,
                amenties,
                other_detail,
                social_media,
                location,
                hours_of_operation,
                seo,
                geometry,
                slug,
                price,
                brand
            })
        } catch (error) {
            throw error;
        }
    }

    async updateStudentHousingSpace({
        id,
        name,
        description,
        images,
        amenties,
        other_detail,
        social_media,
        location,
        seo,
        price,
        brand
    }) {
        try {
            const geometry = this._setGeoLocation(location);
            const slug = await this._createSlug(id, name, location.name)
            return await StudentHousing.findOneAndUpdate({ _id: id }, {
                name,
                description,
                images,
                amenties,
                other_detail,
                social_media,
                location,
                seo,
                geometry,
                slug,
                price,
                brand
            })
        } catch (error) {
            throw error;
        }
    }

    async changeStudentHousingSpaceStatus({ StudentHousingSpaceId, status }) {
        try {
            return await StudentHousing.findOneAndUpdate({ _id: StudentHousingSpaceId }, { $set: { status } });
        } catch (error) {
            throw error;
        }
    }

    async addPriorityStudentHousingSpace({ id, type, data }) {
        try {
            let object = manageWorkSpaceService._createDynamicPriorityType(type);
            if (!data.is_active) {
                const { priority } = await StudentHousing.findOne({ _id: id }, { priority: 1 });
                const priorityOrder = object + '.order';
                const priorityActive = object + '.is_active';
                const condition = {
                    [priorityOrder]: { $gt: priority[type].order },
                    [priorityActive]: true
                };
                if (data.city) {
                    condition['location.city'] = data.city;
                }
                await StudentHousing.updateMany(condition, {
                    $inc: {
                        [priorityOrder]: -1
                    }
                });
            }
            await StudentHousing.updateOne({ '_id': id }, {
                $set: {
                    [object]: data
                }
            });
            return true;
        } catch (error) {
            throw (error);
        }
    }

    async setPriorityByType({ initialPosition, finalPosition, shiftedId, type }) {
        try {
            const priorityOrder = manageWorkSpaceService._createDynamicPriorityType(type) + '.order';
            const priorityActive = manageWorkSpaceService._createDynamicPriorityType(type) + '.is_active';
            if (initialPosition < finalPosition) {
                await StudentHousing.updateMany({
                    [priorityOrder]: { $lte: finalPosition, $gt: initialPosition },
                    [priorityActive]: true
                }, {
                    $inc: {
                        [priorityOrder]: -1
                    }
                })
                await StudentHousing.updateOne({ _id: shiftedId }, {
                    $set: {
                        [priorityOrder]: finalPosition
                    }
                })
            }
            if (initialPosition > finalPosition) {
                await StudentHousing.updateMany({
                    [priorityOrder]: { $lt: initialPosition, $gte: finalPosition },
                    [priorityActive]: true
                }, {
                    $inc: {
                        [priorityOrder]: 1
                    }
                })
                await StudentHousing.updateOne({ _id: shiftedId }, {
                    $set: {
                        [priorityOrder]: finalPosition
                    }
                })
            }
        } catch (e) {
            throw (e)
        }
    }

    /** default lat long is used of Cyber Park Sector 67, Gurugram, Haryana 122005 */
    _setGeoLocation({ latitude = 28.549670700000004, longitude = 77.21564350000001 }) {
        return {
            type: 'Point',
            coordinates: [+longitude, +latitude]
        }
    }

    async _createSlug(id, name, location) {
        try {
            if (id) {
                const ws = await StudentHousing.findOne({ _id: id });
                if (ws && ws.slug) {
                    return ws.slug;
                }
            }
            let slugName = `${name} ${location}`;
            slugName = slugName.toString().toLowerCase()
                .replace(/\s+/g, '-') // Replace spaces with -
                .replace(/[^\w\-]+/g, '') // Remove all non-word chars
                .replace(/\-\-+/g, '-') // Replace multiple - with single -
                .replace(/^-+/, '') // Trim - from start of text
                .replace(/-+$/, ''); // Trim - from end of text
            const ws = await StudentHousing.findOne({ slug: slugName });
            if (ws) {
                slugName = ws.slug + '-' + crypto.randomBytes(2).toString('hex');
            }
            return slugName;
        } catch (error) {
            throw (error);
        }
    }

    async deleteStudentHousingSpace({ id }) {
        try {
            const os = await StudentHousing.findOne({ _id: id }).populate('images.image');
            os && os.images.forEach(async(imageObject) => {
                const folder_name = FileUpload.findFolderFromPath(imageObject.image.s3_link);
                await Image.deleteOne({ _id: imageObject.image._id });
                await FileUtility.deleteFile(imageObject.image.name, folder_name);
            });
            await StudentHousing.deleteOne({ _id: id });
            return true;
        } catch (error) {
            throw (error);
        }
    }

    async changeSlugById({ id, slug }) {
        try {
            const os = await StudentHousing.findOne({ slug, _id: { $nin: [id] } });
            if (os) {
                this._throwException('Opps! Slug is already used by another Co-Living space');
            }
            await StudentHousing.findOneAndUpdate({ _id: id }, { slug });
            return true;
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

export default new ManageStudentHousingSpaceService();