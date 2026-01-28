import { body } from 'express-validator';

const userValidation = [
    body('fullName')
        .notEmpty().withMessage('Full name is required')
        .isLength({ min: 2, max: 15 }).withMessage('Full name must be between 2 and 15 characters'),

    body('email')
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email'),

    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 6, max: 14 }).withMessage('Password must be between 6 and 14 characters')
        .matches(/[A-Za-z]/).withMessage('Password must contain at least one letter')
        .matches(/\d/).withMessage('Password must contain at least one number')
        .matches(/[@$!%*?&]/).withMessage('Password must contain at least one special character (@$!%*?&)'),
];

export default userValidation;
