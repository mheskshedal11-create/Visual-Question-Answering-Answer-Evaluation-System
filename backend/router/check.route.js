import express from 'express';
import upload from "../middleware/multer.js";
import {
    checkController,
    getAllChecks,
    getCheckById,
    deleteCheck
} from "../controllers/check.controller.js";

const checkRouter = express.Router();

// POST - Upload and analyze image or process prompt (image is optional)
checkRouter.post('/post', upload.single('image'), checkController);

// GET - Get all checks
checkRouter.get('/all', getAllChecks);

// GET - Get single check by ID
checkRouter.get('/:id', getCheckById);

// DELETE - Delete check by ID
checkRouter.delete('/:id', deleteCheck);

export default checkRouter;