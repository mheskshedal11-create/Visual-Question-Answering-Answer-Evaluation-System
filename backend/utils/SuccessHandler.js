class SuccessResponse {
    constructor({ message, data = null, statusCode = 200 }) {
        this.success = true
        this.statusCode = statusCode
        this.message = message
        if (data !== null) this.data = data
    }
}

export default SuccessResponse
