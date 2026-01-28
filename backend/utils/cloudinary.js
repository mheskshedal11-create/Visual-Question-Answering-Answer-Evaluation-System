import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload image buffer to Cloudinary
 * @param {Buffer} buffer - Image buffer from multer
 * @param {string} filename - Original filename
 * @returns {Promise<string>} - Cloudinary URL
 */
const uploadCloudinary = async (buffer, filename) => {
    try {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'aifolder',
                    public_id: `check_${Date.now()}`,
                    resource_type: 'auto'
                },
                (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result.secure_url);
                    }
                }
            );

            // Convert buffer to stream and pipe to cloudinary
            const readableStream = Readable.from(buffer);
            readableStream.pipe(uploadStream);
        });
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw new Error('Failed to upload image to Cloudinary');
    }
};

export default uploadCloudinary;