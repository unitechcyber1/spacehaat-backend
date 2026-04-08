import ManageCoworkingPageService from '../../services/admin/manage-coworking-page.js';


class ManageCoworkingPage {
    constructor() {
        return {
            getCoworkingPageById: this.getCoworkingPageById.bind(this),
            createCoworkingPage: this.createCoworkingPage.bind(this),
        }
    }

    async createCoworkingPage(req, res, next) {
        try {
            let workSpace = null;
            let message = 'Page Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body)
                workSpace = await ManageCoworkingPageService.updateCoworkingPage(forEdit)
                message = 'Page Updated';
            } else {
                workSpace = await ManageCoworkingPageService.createCoworkingPage(req.body)
            }
            res.status(200).json({
                message: message,
                data: workSpace
            })
        } catch (error) {
            next(error)
        }
    }

    async getCoworkingPageById(req, res, next) {
        try {
            const result = await ManageCoworkingPageService.getCoworkingPageById(req.params);
            res.status(200).json({
                message: 'Page by Id',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

}

export default new ManageCoworkingPage();