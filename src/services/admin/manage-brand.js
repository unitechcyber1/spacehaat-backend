import models from '../../models/index.js';
const Brand = models['Brand'];
const WorkSpace = models['WorkSpace'];
const CoLivingSpace = models['CoLivingSpace'];
const Flats = models['Flats'];
const Image = models['Image'];
import crypto from 'crypto';
import manageCityService from './manage-city.js';
import FileUpload from "../../controllers/common/fileUpload.js";
import FileUtility from '../../utilities/file.js'
class ManageBrandService {
    constructor() {
        return {
            getBrandById: this.getBrandById.bind(this),
            getBrandByName: this.getBrandByName.bind(this),
            getBrands: this.getBrands.bind(this),
            createBrand: this.createBrand.bind(this),
            updateBrand: this.updateBrand.bind(this),
            getSpacesByBrand: this.getSpacesByBrand.bind(this),
            getSpacesByBrandAndCity: this.getSpacesByBrandAndCity.bind(this),
            getColivingByBrand: this.getColivingByBrand.bind(this),
            deleteBrand: this.deleteBrand.bind(this)
        }
    }

    async getBrandById({ id }) {
        try {
            const brand = await Brand.findOne({ _id: id })
                .populate('image')
                .populate('images.image')
            return brand;
        } catch (error) {
            throw (error);
        }
    }

    async getBrandByName({ name }) {
        try {
            let nameSearch = '.*' + name + '.*';
            nameSearch = { $regex: new RegExp('^' + name + '$', 'i') };
            const brand = await Brand.findOne({ name: nameSearch })
                .populate('cities');
            return brand;
        } catch (error) {
            throw (error);
        }
    }

    async getBrands({ limit, skip, orderBy = 1, sortBy = 'order', name, dropdown, type }) {
        try {
            const result = {};
            let condition = {};
            if (name) {
                name = '.*' + name + '.*';
                condition['name'] = { $regex: new RegExp('^' + name + '$', 'i') };
            }
            if (type) {
                condition['type'] = type;
            }
            if (dropdown) {
                result.brands = await Brand.find(condition)
                    .populate('image')
                    .populate('images.image')
                    .populate('cities');
            } else {
                result.brands = await Brand.find(condition)
                    .populate('image')
                    .populate('images.image')
                    .populate('cities')
                    .limit(limit)
                    .skip(skip)
                    .sort({
                        [sortBy]: orderBy
                    });
            }
            result.count = await Brand.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }
    async createBrand({ name, description,review, order,logo_tag_line, brand_tag, brand_tag_line, images, image, seo, cities, type, should_show_on_home, google_sheet_url, trusted_user }) {
        try {
            await this._setOrdering(order);
            const slug = await this._createSlug(null, name);
            const brand = await Brand.create({ name: name.toLowerCase(), description, order,logo_tag_line, brand_tag, brand_tag_line, images, review, image, slug, seo, cities, type, should_show_on_home, google_sheet_url, trusted_user });
            return brand;
        } catch (error) {
            throw (error);
        }
    }

    async updateBrand({ brandId, name, description, review,  order,logo_tag_line, brand_tag, brand_tag_line, images, image, seo, cities, type, should_show_on_home, google_sheet_url, trusted_user }) {
        try {
            await this._setOrdering(order);
            const slug = await this._createSlug(brandId, name);
            return await Brand.findOneAndUpdate({ _id: brandId }, { name, description, review,  order,logo_tag_line, brand_tag, brand_tag_line, images, image, slug, seo, cities, type, should_show_on_home, google_sheet_url, trusted_user }, { new: true });
        } catch (e) {
            throw (e)
        }
    }

    async deleteBrand({ id }) {
        try {
            const brandDetails = await Brand.findOne({ _id: id }).populate("image");
            if(brandDetails) {
                const folder_name = FileUpload.findFolderFromPath(brandDetails.image.s3_link);
                if(brandDetails.image != null){
                    await Image.deleteOne({_id: brandDetails.image._id});
                    await FileUtility.deleteFile(brandDetails.image.name, folder_name);
                }
                await Brand.deleteOne({_id: id});
            }
            return true;
        } catch (error) {
            throw error;
        }
    }

    async getSpacesByBrand({ slug, limit, category = 'day-pass', minPrice, maxPrice, skip, orderBy = 1, sortBy = 'name' }) {
        try {
            let result = {
                count: 0,
                workSpaces: []
            };
            slug = slug.toLowerCase();
            const brand = await Brand.findOne({ slug });
            if (brand) {
                let condition = { brand: brand.id, status: 'approve' };
                if (minPrice && maxPrice) {
                    condition['plans'] = { $elemMatch: { 'category': category, 'price': { $gte: +minPrice, $lte: +maxPrice } } };
                }
                result.workSpaces = await WorkSpace.find(condition)
                    .populate({ path: 'brand', select: 'name slug _id id description cities', populate: 'image cities' })
                    .populate('location.city')
                    .populate('images.image')
                    .populate('seo.twitter.image')
                    .populate('seo.open_graph.image')
                    .limit(limit)
                    .skip(skip)
                    .sort({
                        [sortBy]: orderBy
                    });
                result.count = await WorkSpace.countDocuments(condition);
            }
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async getColivingByBrand({ slug, limit, minPrice, maxPrice, skip, orderBy = 1, sortBy = 'name' }) {
        try {
            let result = {
                count: 0,
                colivings: []
            };
            slug = slug.toLowerCase();
            const brand = await Brand.findOne({ slug });
            if (brand) {
                let condition = { brand: brand.id, status: 'approve' };
                if (minPrice && maxPrice) {
                    condition['plans'] = { $elemMatch: { 'price': { $gte: +minPrice, $lte: +maxPrice } } };
                }
                result.colivings = await CoLivingSpace.find(condition)
                    .populate({ path: 'brand', select: 'name slug _id id description cities', populate: 'image cities' })
                    .populate('location.city')
                    .populate('images.image')
                    .populate('seo.twitter.image')
                    .populate('seo.open_graph.image')
                    .limit(limit)
                    .skip(skip)
                    .sort({
                        [sortBy]: orderBy
                    });
                result.count = await CoLivingSpace.countDocuments(condition);
            }
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async getSpacesByBrandAndCity({
        slug,
        city: cityName,
        limit,
        category = 'day-pass',
        minPrice,
        maxPrice,
        skip,
        orderBy = 1,
        sortBy = 'name'
    }) {
        try {
            let result = {
                count: 0,
                workSpaces: []
            };
            slug = slug.toLowerCase();
            const brand = await Brand.findOne({ slug });
            if (brand) {
                let condition = { brand: brand.id, status: 'approve' };
                if (minPrice && maxPrice) {
                    condition['plans'] = { $elemMatch: { 'category': category, 'price': { $gte: +minPrice, $lte: +maxPrice } } };
                }
                const city = await manageCityService.getCityByName({ cityName });
                if (city) {
                    condition['location.city'] = city._id;
                }
                result.workSpaces = await WorkSpace.find(condition)
                    .populate({ path: 'brand', select: 'name slug _id id description cities', populate: 'image cities' })
                    .populate('location.city')
                    .populate('images.image')
                    .populate('seo.twitter.image')
                    .populate('seo.open_graph.image')
                    .limit(limit)
                    .skip(skip)
                    .sort({
                        [sortBy]: orderBy
                    });
                result.count = await WorkSpace.countDocuments(condition);
            }
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async _setOrdering(order) {
        try {
            const count = await Brand.findOne({ order });
            if (count) {
                await Brand.updateMany({ order: { $gte: order } }, { $inc: { order: 1 } })
            }
        } catch (e) {
            throw (e)
        }
    }

    async _createSlug(id, name) {
        try {
            name = name.toString().toLowerCase()
                .replace(/\s+/g, '-') // Replace spaces with -
                .replace(/[^\w\-]+/g, '') // Remove all non-word chars
                .replace(/\-\-+/g, '-') // Replace multiple - with single -
                .replace(/^-+/, '') // Trim - from start of text
                .replace(/-+$/, ''); // Trim - from end of text
            if (id) {
                const brand = await Brand.findOne({ slug: name });
                if (brand && brand.slug) {
                    return brand.slug;
                }
            }
            const brand = await Brand.findOne({ slug: name });
            if (brand) {
                name = brand.slug + '-' + crypto.randomBytes(2).toString('hex');
            }
            return name;
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

export default new ManageBrandService()