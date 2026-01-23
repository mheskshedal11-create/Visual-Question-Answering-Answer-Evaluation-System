import mongoose from "mongoose";

const connection = async () => {
    try {
        let res = await mongoose.connect(process.env.MONGO_URL)
        console.log('database connect successfully')
    } catch (error) {
        console.log(error)
    }
}

export default connection