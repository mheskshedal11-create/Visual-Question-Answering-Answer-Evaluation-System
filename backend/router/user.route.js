import { Router } from 'express'
import { loginController, logOutController, registerController } from '../controllers/user.controller.js'
import userValidation from '../validation/user.js'
import handleValidationErrors from '../validation/validationError.js'
import authorization from '../middleware/authMiddleware.js'
const userRouter = Router()
userRouter.post('/register', userValidation, handleValidationErrors, registerController)
userRouter.post('/login', loginController)
userRouter.post('/logout', authorization, logOutController)
export default userRouter