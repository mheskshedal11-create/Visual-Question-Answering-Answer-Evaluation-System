import multer from "multer";

// Use memory storage instead of disk storage
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed!"), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max file size
    }
});

export default upload;