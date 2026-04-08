import manageCategoryService from '../../services/admin/manage-category.js';

class ManageCategory {
    constructor() {
        return {
            getCategorys: this.getCategorys.bind(this),
            getCategoryById: this.getCategoryById.bind(this),
            addOrEditCategory: this.addOrEditCategory.bind(this),
            toggleCategoryStatus: this.toggleCategoryStatus.bind(this),
            deleteCategory: this.deleteCategory.bind(this),
            ActiveCategory: this.ActiveCategory.bind(this),
        }
    }

    async getCategorys(req, res, next) {
        try {
            const result = await manageCategoryService.getCategory(req.query);
            return res.status(200).json({
                message: "State List",
                data: result.states,
                totalRecords: result.count
            })
        } catch (e) {
            next(e)
        }
    }
    async ActiveCategory(req, res, next) {
        try {
            const result = await manageCategoryService.getActiveCategory(req.query);
            return res.status(200).json({
                message: "State List",
                data: result,
                totalRecords: result.length
            })
        } catch (e) {
            next(e)
        }
    }

    async getCategoryById(req, res, next) {
        try {
            const state = await manageCategoryService.getCategoryById(req.params);
            res.status(200).json({
                message: 'get State by id',
                data: state
            })
        } catch (error) {
            next(error);
        }
    }

    async addOrEditCategory(req, res, next) {
        try {
            let state = null;
            let message = 'Category Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body);
                state = await manageCategoryService.updateCategory(forEdit);
                message = 'Category Updated';
            } else {
                state = await manageCategoryService.addCategory(req.body);
            }
            res.status(200).json({
                message,
                data: state
            });
        } catch (error) {
            next(error)
        }
    }

    async toggleCategoryStatus(req, res, next) {
        try {
            await manageCategoryService.toggleCategoryStatus(req.params);
            return res.status(200).json({
                message: "State Status Changed"
            })
        } catch (e) {
            next(e)
        }
    }

    async deleteCategory(req, res, next) {
        try {
            await manageCategoryService.deleteCategory(req.params);
            res.status(200).json({
                message: 'Room deleted'
            })
        } catch (error) {
            next(error);
        }
    }



}

export default new ManageCategory();