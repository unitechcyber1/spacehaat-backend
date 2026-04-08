import models from '../../models/index.js';

const Category = models['Category'];

class ManageCategoryService {
    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
        return {
            getCategory: this.getCategory.bind(this),
            getCategoryById: this.getCategoryById.bind(this),
            getCategoryByName: this.getCategoryByName.bind(this),
            addCategory: this.addCategory.bind(this),
            updateCategory: this.updateCategory.bind(this),
            toggleCategoryStatus: this.toggleCategoryStatus.bind(this),
            deleteCategory: this.deleteCategory.bind(this),
            getActiveCategory: this.getActiveCategory.bind(this)
        }
    }

    async getCategory({ limit, skip, orderBy = 1, sortBy = 'name', name, dropdown }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                name = '.*' + name + '.*';
                condition['name'] = { $regex: new RegExp('^' + name + '$', 'i') };
            }
            if (dropdown) {
                result.states = await Category.find(condition)
                    .sort({
                        [sortBy]: orderBy
                    });
            } else {
                result.states = await Category.find(condition)
                    .populate('icons')
                    .limit(limit)
                    .skip(skip)
                    .sort({
                        [sortBy]: orderBy
                    });
            }
            result.count = await Category.countDocuments(condition);
            return result;
        } catch (e) {
            throw (e)
        }
    }

    async getCategoryById({ id }) {
        try {
            const state = await Category.findOne({ _id: id });
            return state;
        } catch (error) {
            throw (error);
        }
    }

    async getActiveCategory({}) {
        try {
            const state = await Category.find({ active: true });
            return state;
        } catch (error) {
            throw (error);
        }
    }

    async getCategoryByName({ stateName }) {
        try {
            let findName = '.*' + stateName + '.*';
            findName = { $regex: new RegExp('^' + stateName + '$', 'i') };
            const state = await Category.findOne({ name: findName });
            return state;
        } catch (error) {
            throw (error);
        }
    }

    async addCategory({ name, description, country, icons }) {
        try {
            const state = await Category.create({ name, description, country, icons });
            return state;
        } catch (e) {
            throw (e)
        }
    }

    async updateCategory({ categoryId, name, description, country, icons }) {
        try {
            return await Category.findOneAndUpdate({ _id: categoryId }, { name, description, country, icons }, { new: true });
        } catch (e) {
            throw (e)
        }
    }

    async toggleCategoryStatus({ categoryId }) {
        try {
            const stateStatus = await Category.findOne({ _id: categoryId });
            const state = await Category.findByIdAndUpdate({ _id: categoryId }, { active: !stateStatus.active }, this.updateOptions);
            return state;
        } catch (e) {
            throw (e)
        }
    }

    async deleteCategory({ categoryId }) {
        try {
            await Category.deleteOne({ _id: categoryId });
            return true;
        } catch (error) {
            throw (error)
        }
    }
}

export default new ManageCategoryService();