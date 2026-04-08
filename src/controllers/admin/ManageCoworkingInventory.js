import ManageCoworkingInventoryPageService from "../../services/admin/manage-coworking-inventory.js";


class ManageCoworkingInventoryPage {
    constructor() {
        return {
            getCoworkingInventories: this.getCoworkingInventories.bind(this),
            getCoworkingInventoryById: this.getCoworkingInventoryById.bind(this),
            createOrUpdateCoworkingInventory: this.createOrUpdateCoworkingInventory.bind(this),
            deleteWorkSpaceInventory: this.deleteWorkSpaceInventory.bind(this),
            uploadInventory: this.uploadInventory.bind(this),
            leadRegisterOnMail: this.leadRegisterOnMail.bind(this)
        }
    }

    async createOrUpdateCoworkingInventory(req, res, next) {
        try {
            let inventory = null;
            let message = 'Page Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body)
                inventory = await ManageCoworkingInventoryPageService.updateCoworkingInventory(forEdit)
                message = 'Page Updated';
            } else {
                inventory = await ManageCoworkingInventoryPageService.createCoworkingInventory(req.body)
            }
            res.status(200).json({
                message: message,
                data: inventory
            })
        } catch (error) {
            next(error)
        }
    }
    async leadRegisterOnMail(req, res, next) {
        try {
            // Validate input first
            if (!req.body.toEmails || !Array.isArray(req.body.toEmails)) {
                return res.status(400).json({ 
                    success: false,
                    message: "Invalid email addresses format" 
                });
            }
            // Pass to service
            const result = await ManageCoworkingInventoryPageService.leadRegisterOnMail(req.body);
            res.status(200).json({
                success: result.success,
                message: result.message,
                data: result.data || null  // Always return consistent structure
            });
        } catch (error) {
            // Handle specific error types
            if (error.message === 'No email received') {
                return res.status(400).json({ 
                    success: false,
                    message: "No recipient emails provided" 
                });
            }
            res.status(500).json({ 
                success: false,
                message: "Internal server error. Please try again later." 
            });
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
    
            const result = await ManageCoworkingInventoryPageService.uploadInventory(req.files.file);
            
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

    async getCoworkingInventoryById(req, res, next) {
        try {
            const result = await ManageCoworkingInventoryPageService.getCoworkingInventoryById(req.params);
            res.status(200).json({
                message: 'Page by Id',
                data: result
            })
        } catch (error) {
            next(error)
        }
    }

    async getCoworkingInventories(req, res, next) {
        try {
            const result = await ManageCoworkingInventoryPageService.getCoworkingInventories(req.query);
            res.status(200).json({
                message: 'Inventory details',
                data: result.coworkingInventoryDetails,
                totalRecords: result.count
            })
        } catch (error) {
            next(error)
        }
    }
    async deleteWorkSpaceInventory(req, res, next) {
        try {
            await ManageCoworkingInventoryPageService.deleteWorkSpaceInventory(req.params);
            res.status(200).json({
                message: 'Inventory deleted successfully'
            })
        } catch (error) {
            next(error);
        }
    }

}

export default new ManageCoworkingInventoryPage();