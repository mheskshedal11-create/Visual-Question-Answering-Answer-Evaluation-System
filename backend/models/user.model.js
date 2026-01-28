import mongoose from 'mongoose'
import bcrypt from 'bcrypt'

const userSchema = mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
    },
    refresh_token: {
        type: String
    }
}, { timeStamps: true })

userSchema.pre('save', async function (next) {
    // Only hash password if it's new or modified
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next
});

const User = mongoose.model('User', userSchema)
export default User