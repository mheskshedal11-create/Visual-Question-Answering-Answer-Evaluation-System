import jwt from 'jsonwebtoken'
import User from '../models/user.model.js'

const refreshToken = async (userId) => {
    const token = jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, { algorithm: 'HS256', expiresIn: '7d' })

    const user = await User.findByIdAndUpdate(userId, {
        $set: {
            refresh_token: token
        }
    })

    return token
}

export default refreshToken
