import jwt from 'jsonwebtoken';

const accessToken = (userId) => {
    const token = jwt.sign(
        { userId },
        process.env.ACCESS_TOKEN_SECRET,
        { algorithm: 'HS256', expiresIn: '30m' }
    );
    return token;
};

export default accessToken;
