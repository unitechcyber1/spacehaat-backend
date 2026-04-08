import manageBrandService from '../../services/admin/manage-brand.js';

class ManageBrand {
    constructor() {
        return {
            getBrands: this.getBrands.bind(this),
            getBrandById: this.getBrandById.bind(this),
            addOrEditBrand: this.addOrEditBrand.bind(this),
            getSpacesByBrand: this.getSpacesByBrand.bind(this),
            getSpacesByBrandAndCity: this.getSpacesByBrandAndCity.bind(this),
            getBrandByName: this.getBrandByName.bind(this),
            getColivingByBrand: this.getColivingByBrand.bind(this),
            deleteOneBrand: this.deleteOneBrand.bind(this)
        }
    }

    async getBrands(req, res, next) {
        try {
            const result = await manageBrandService.getBrands(req.query);
            let finalbrands = [];
            result.brands.forEach(element => {
               let name = element.name
               let result = name.match(/colive/);
               if(result == null){
                finalbrands.push(element)
               }
           });
            res.status(200).json({
                message: 'Get Brand list',
                data: finalbrands,
                totalRecords: result.count
            })
        } catch (error) {
            next(error);
        }
    }

    async getBrandById(req, res, next) {
        try {
            const brand = await manageBrandService.getBrandById(req.params);
            res.status(200).json({
                message: 'Get Brand by id',
                data: brand
            })
        } catch (error) {
            next(error);
        }
    }

    async getBrandByName(req, res, next) {
        try {
            const brand = await manageBrandService.getBrandByName(req.params);
            res.status(200).json({
                message: 'Get Brand by name',
                data: brand
            })
        } catch (error) {
            next(error);
        }
    }

    async addOrEditBrand(req, res, next) {
        try {
            let brand = null;
            let message = 'Brand Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body);
                brand = await manageBrandService.updateBrand(forEdit);
                message = 'Brand Updated';
            } else {
                brand = await manageBrandService.createBrand(req.body);
            }
            res.status(200).json({
                message,
                data: brand
            });
        } catch (error) {
            next(error)
        }
    }

    async getSpacesByBrand(req, res, next) {
        try {
            const object = Object.assign({}, req.params, req.query);
            const ws = await manageBrandService.getSpacesByBrand(object);
            res.status(200).json({
                message: 'Get spaces by brand id',
                data: ws.workSpaces,
                totalRecords: ws.count
            })
        } catch (error) {
            next(error);
        }
    }

    async getColivingByBrand(req, res, next) {
        try {
            const object = Object.assign({}, req.params, req.query);
            const ws = await manageBrandService.getColivingByBrand(object);
            res.status(200).json({
                message: 'Get Coliving by brand id',
                data: ws.colivings,
                totalRecords: ws.count
            })
        } catch (error) {
            next(error);
        }
    }

    async getSpacesByBrandAndCity(req, res, next) {
        try {
            const object = Object.assign({}, req.params, req.query);
            const ws = await manageBrandService.getSpacesByBrandAndCity(object);
            res.status(200).json({
                message: 'Get spaces by brand id',
                data: ws.workSpaces,
                totalRecords: ws.count
            })
        } catch (error) {
            next(error);
        }
    }

    async deleteOneBrand(req, res, next) {
        try {
            await manageBrandService.deleteBrand({ id: req.params.brandId });
            res.status(200).json({
                message: 'Brand deleted successfully'
            })
        } catch (error) {
            next(error)
        }
    }

}

export default new ManageBrand();