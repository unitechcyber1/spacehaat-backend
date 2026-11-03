export class ApiError extends Error {
    status;
    code;
    details;

    constructor(status, message, code, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
