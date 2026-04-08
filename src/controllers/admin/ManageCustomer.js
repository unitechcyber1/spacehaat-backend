import manageCustomer from "../../services/admin/manage-customer.js";


class ManageCustomerInventoryPage {
    constructor() {
        return {
            getCustomerInventories: this.getCustomerInventories.bind(this),
            getCustomerInventoryById: this.getCustomerInventoryById.bind(this),
            createOrUpdateCustomerInventory: this.createOrUpdateCustomerInventory.bind(this),
            deleteWorkSpaceInventory: this.deleteWorkSpaceInventory.bind(this),
            uploadInventory: this.uploadInventory.bind(this),
        }
    }

    async createOrUpdateCustomerInventory(req, res, next) {
        try {
            let inventory = null;
            let message = 'Page Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body)
                inventory = await manageCustomer.updateCustomer(forEdit)
                message = 'Page Updated';
            } else {
                inventory = await manageCustomer.createCustomer(req.body)
            }
            res.status(200).json({
                message: message,
                data: inventory
            })
        } catch (error) {
            next(error)
        }
    }
    async uploadInventory(req, res, next) {
        try {
            if (!req.files || !req.files.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded',
                    code: 'NO_FILE'
                });
            }
    
            const result = await manageCustomer.uploadInventory(req.files.file);
            
            res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    inserted: result.insertedCount,
                    errors: result.errors
                }
            });
        } catch (error) {
            // Map service errors to HTTP responses
            const errorMap = {
                'NO_FILE': { status: 400, message: 'No file received' },
                'TEMP_FILE_MISSING': { status: 400, message: 'File processing error' },
                'INVALID_FILE_TYPE': { status: 415, message: 'Only CSV/XLSX files allowed' },
                'FILE_PARSE_ERROR': { status: 422, message: 'Cannot read file content' },
                'EMPTY_FILE': { status: 422, message: 'File contains no data' },
                'INVALID_DATA_FORMAT': { status: 422, message: 'Invalid data format in file' },
                'PARTIAL_INSERT': { status: 207, message: 'Partial data inserted' },
                default: { status: 500, message: 'Internal server error' }
            };
    
            const { status, message } = errorMap[error.message] || errorMap.default;
            
            if (status === 500) {
                console.error('Server Error:', error);
            }
    
            res.status(status).json({
                success: false,
                message,
                code: error.message,
                details: status === 422 ? error.details : undefined
            });
        }
    }

    async getCustomerInventoryById(req, res, next) {
        try {
            const result = await manageCustomer.getCustomerById(req.params);
            res.status(200).json({
                message: 'Page by Id',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async getCustomerInventories(req, res, next) {
        try {
            const result = await manageCustomer.getCustomers(req.query);
            res.status(200).json({
                message: 'Inventory details',
                data: result.CustomerDetails,
                totalRecords: result.count
            })
        } catch (error) {
            next(error)
        }
    }
    async deleteWorkSpaceInventory(req, res, next) {
        try {
            await manageCustomer.deleteCustomer(req.params);
            res.status(200).json({
                message: 'Inventory deleted successfully'
            })
        } catch (error) {
            next(error);
        }
    }

}

export default new ManageCustomerInventoryPage();