import accessToken from "../middleware/accessToken.js";
import refreshToken from "../middleware/refreshToken.js";
import User from "../models/user.model.js";
import bcrypt from 'bcrypt'
// for user register 
export const registerController = async (req, res) => {
    try {
        const { fullName, email, password } = req.body

        // Check if user already exists
        const user = await User.findOne({ email })
        if (user) {
            return res.status(409).json({  // 409 Conflict
                success: false,
                message: "This email is already registered"
            })
        }

        // Create new user
        const newUser = new User({
            fullName,
            email,
            password
        })

        await newUser.save()

        const userObj = newUser.toObject();
        delete userObj.password;


        return res.status(201).json({
            success: true,
            message: "User created successfully",
            user: userObj
        })

    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: "Failed to register user"
        })
    }
}
//for user login
export const loginController = async (req, res) => {
    try {
        const { email, password } = req.body
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Invalid Email or Password !"
            })
        }
        const comparePassword = await bcrypt.compare(password, user.password)

        if (!comparePassword) {
            return res.status(404).json({
                success: false,
                message: "Invalid Email or Password"
            })
        }
        const ACCESS_TOKEN = accessToken(user._id);
        const REFRESH_TOKEN = refreshToken(user._id);

        const cookieOptions = {
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
            maxAge: 1000 * 60 * 30
        }
        res.cookie('accessToken', ACCESS_TOKEN, cookieOptions);
        res.cookie('refreshToken', REFRESH_TOKEN, {
            ...cookieOptions,
            maxAge: 1000 * 60 * 60 * 24 * 7
        });

        return res.status(200).json({
            success: false,
            message: 'User login Succesfully'
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: "Faield to login ! server Error"
        })
    }
}

//for user logut
export const logOutController = async (req, res) => {
    try {
        const userId = req.user.id
        const cookieOptions = {
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
            maxAge: 0
        };

        // Clear cookies
        res.clearCookie('accessToken', cookieOptions);
        res.clearCookie('refreshToken', cookieOptions);

        // Remove refresh token from DB
        await User.findByIdAndUpdate(userId, {
            $set: { refresh_token: null }
        });

        return res.status(200).json({
            success: true,
            message: 'Logout successful'
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: 'Failed to logout user'
        });
    }
};