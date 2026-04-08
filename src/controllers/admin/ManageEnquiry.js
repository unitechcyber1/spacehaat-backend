import manageEnquiryService from '../../services/admin/manage-enquiry.js';

class ManageEnquiry {
    constructor() {
        return {
            getEnquiries: this.getEnquiries.bind(this),
            getVendorenquiries: this.getVendorenquiries.bind(this),
            getEnquiryById: this.getEnquiryById.bind(this),
            changeStatus: this.changeStatus.bind(this),
            deleteLead: this.deleteLead.bind(this),
            exportLeads: this.exportLeads.bind(this),
            updateLeads: this.updateLeads.bind(this),
            addNoteToLead: this.addNoteToLead.bind(this),
            updateNoteInLead: this.updateNoteInLead.bind(this),
            deleteNoteInLead: this.deleteNoteInLead.bind(this),
            createManualLead: this.createManualLead.bind(this),
            updateManualLead: this.updateManualLead.bind(this),
            deleteManyLead: this.deleteManyLead.bind(this),
            leadsAccess: this.leadsAccess.bind(this),
            removeLeadsAccess: this.removeLeadsAccess.bind(this),
            getEnquiryCount: this.getEnquiryCount.bind(this)
        }
    }


   async exportLeads(req, res, next) {
        try {
            const result = await manageEnquiryService.exportLeads(req.query);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=data.csv');
            res.status(200).end(result);
            // res.status(200).json({
            //     message: 'export Enquiry list',
            // })
        } catch (error) {
            next(error);
        }
    }
    async updateLeads(req, res, next) {
        try {
            const admin = await manageEnquiryService.updateLeads(req.body);
            res.status(200).json({
                message: 'Lead updated',
                data: admin
            });
        } catch (error) {
            next(error);
        }
    }
    async leadsAccess(req, res, next) {
        try {
            const admin = await manageEnquiryService.leadsAccess(req.body);
            res.status(200).json({
                message: 'Access updated',
                data: admin
            });
        } catch (error) {
            next(error);
        }
    }
    async removeLeadsAccess(req, res, next) {
        try {
            const admin = await manageEnquiryService.removeLeadsAccess(req.body);
            res.status(200).json({
                message: 'Access updated',
                data: admin
            });
        } catch (error) {
            next(error);
        }
    }
    async addNoteToLead(req, res, next) {
        try {
            const admin = await manageEnquiryService.addNoteToLead(req.body);
            res.status(200).json({
                message: 'Note Added',
                data: admin
            });
        } catch (error) {
            next(error);
        }
    }
    async createManualLead(req, res, next) {
        try {
            const lead = await manageEnquiryService.createManualLead(req.body);
            res.status(200).json({
                message: 'Lead Added',
                data: lead
            });
        } catch (error) {
            next(error);
        }
    }
    async updateManualLead(req, res, next) {
        try {
            const lead = await manageEnquiryService.updateManualLead(req.body);
            res.status(200).json({
                message: 'Lead updated',
                data: lead
            });
        } catch (error) {
            next(error);
        }
    }
    async updateNoteInLead(req, res, next) {
        try {
            const admin = await manageEnquiryService.updateNoteInLead(req.body);
            res.status(200).json({
                message: 'Note Updated',
                data: admin
            });
        } catch (error) {
            next(error);
        }
    }
    async deleteNoteInLead(req, res, next) {
        try {
            const admin = await manageEnquiryService.deleteNoteInLead(req.body);
            res.status(200).json({
                message: 'Note Deleted',
                data: admin
            });
        } catch (error) {
            next(error);
        }
    }
    
    async getEnquiries(req, res, next) {
        try {
            const result = await manageEnquiryService.getEnquiries(req.query);
            res.status(200).json({
                message: 'get Enquiry list',
                data: result.enquiries,
                totalRecords: result.count
            })
        } catch (error) {
            next(error);
        }
    }
    async getEnquiryCount(req, res, next) {
        try {
            const result = await manageEnquiryService.getEnquiryCount(req.query);
            res.status(200).json({
                message: 'get Enquiry Count',
                totalRecords: result
            })
        } catch (error) {
            next(error);
        }
    }
    async deleteLead(req, res, next) {
        try {
            await manageEnquiryService.deleteLead(req.params);
            res.status(200).json({
                message: 'delete Enquiry'
            })
        } catch (error) {
            next(error);
        }
    }
    async deleteManyLead(req, res, next) {
        try {
            await manageEnquiryService.deleteManyLead(req.body);
            res.status(200).json({
                message: 'Enquiry deleted'
            })
        } catch (error) {
            next(error);
        }
    }

    async getVendorenquiries(req, res, next) {
        try {
            const result = await manageEnquiryService.getVendorenquiries(req.query);
            if(req.query.exports){
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename=data.csv');
                res.status(200).end(result);
            }
            else {
                res.status(200).json({
                    message: 'get Enquiry list',
                    data: result.enquiries,
                    totalRecords: result.count
                })
            }
        } catch (error) {
            next(error);
        }
    }

    async getEnquiryById(req, res, next) {
        try {
            const enquiry = await manageEnquiryService.getEnquiryById(req.params);
            res.status(200).json({
                message: 'get Enquiry by id',
                data: enquiry
            })
        } catch (error) {
            next(error);
        }
    }

    async changeStatus(req, res, next) {
        try {
            const object = Object.assign({}, req.body, req.params);
            const enquiry = await manageEnquiryService.changeStatus(object);
            res.status(200).json({
                message: 'Enquiry status changed',
                data: enquiry
            })
        } catch (error) {
            next(error);
        }
    }

}

export default new ManageEnquiry();