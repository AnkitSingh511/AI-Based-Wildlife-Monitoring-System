const errorMiddleware = (err, req, res, next) => {
    console.error(err);

    // Mongoose validation error
    if (err.name === "ValidationError") {
        return res.status(400).json({
            message: "Validation error",
            errors: Object.values(err.errors).map(
                (error) => error.message
            )
        });
    }

    // Invalid MongoDB ObjectId
    if (err.name === "CastError") {
        return res.status(400).json({
            message: "Invalid ID"
        });
    }

    // Duplicate MongoDB value
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];

        return res.status(409).json({
            message: `${field} already exists`
        });
    }

    // Specific status or default server error
    const statusCode = err.statusCode || err.status || 500;
    return res.status(statusCode).json({
        message: err.message || "Internal server error"
    });
};

export default errorMiddleware;