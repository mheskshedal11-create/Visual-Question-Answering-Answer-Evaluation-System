import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

const authorization = async (req, res, next) => {
    try {
        // Get token from cookie or Authorization header
        let token = req.cookies?.accessToken || req.headers?.authorization;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Please login'
            });
        }

        // If token comes from header, remove "Bearer " prefix
        if (token.startsWith('Bearer ')) {
            token = token.slice(7, token.length);
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        // Find user in DB
        const user = await User.findById(decoded.userId); // match your payload key
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Attach user info to request
        req.user = user;

        next();
    } catch (error) {
        console.error(error);
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};

export default authorization;
