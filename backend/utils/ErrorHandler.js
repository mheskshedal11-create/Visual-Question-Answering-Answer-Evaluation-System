class ErrorHandler {
    constructor(message, statusCode = 500) {
        this.success = false
        this.statusCode = statusCode
        this.message = message
    }
}

export default ErrorHandler
