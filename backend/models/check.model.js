import mongoose from "mongoose";

const checkSchema = new mongoose.Schema(
    {
        prompt: {
            type: String,
            trim: true,
            default: "",
        },
        image: {
            type: String, // Cloudinary URL (empty if only prompt provided)
            default: "",
        },
        extractedText: {
            type: String, // OCR extracted text from image (empty if only prompt)
            default: "",
        },
        result: {
            type: Object, // AI analysis result
            default: {},
        },
    },
    {
        timestamps: true
    }
);

const Check = mongoose.model("Check", checkSchema);

export default Check;