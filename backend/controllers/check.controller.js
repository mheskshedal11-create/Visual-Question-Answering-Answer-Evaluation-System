import Check from "../models/check.model.js";
import { GoogleGenAI } from "@google/genai";
import Tesseract from 'tesseract.js';
import uploadCloudinary from "../utils/cloudinary.js";
import NodeCache from 'node-cache';

// Initialize Google AI with new SDK
const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API
});

// Initialize cache (1 hour TTL)
const cache = new NodeCache({ stdTTL: 3600 });

// Helper function to clean markdown formatting from text
const cleanMarkdownFormatting = (text) => {
    if (!text) return text;

    return text
        // Remove markdown bold (**text** or __text__)
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        // Remove markdown italic (*text* or _text_)
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/_(.+?)_/g, '$1')
        // Remove markdown headers (# ## ### etc)
        .replace(/^#{1,6}\s+/gm, '')
        // Remove markdown list markers (*, -, +, 1., 2., etc)
        .replace(/^\s*[\*\-\+]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '')
        // Remove markdown code blocks (```code```)
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`(.+?)`/g, '$1')
        // Remove extra whitespace
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
};

// Helper function to clean JSON object recursively
const cleanJsonObject = (obj) => {
    if (typeof obj === 'string') {
        return cleanMarkdownFormatting(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => cleanJsonObject(item));
    }

    if (obj !== null && typeof obj === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            cleaned[key] = cleanJsonObject(value);
        }
        return cleaned;
    }

    return obj;
};

// Rate limiting helper
let requestCount = 0;
let resetTime = Date.now() + 60000; // Reset every minute

const checkRateLimit = () => {
    if (Date.now() > resetTime) {
        requestCount = 0;
        resetTime = Date.now() + 60000;
    }

    if (requestCount >= 10) { // Limit to 10 requests per minute
        return false;
    }

    requestCount++;
    return true;
};

export const checkController = async (req, res) => {
    try {
        const { prompt } = req.body;
        const imageFile = req.file;

        // Validate that at least one input is provided
        if (!imageFile && !prompt) {
            return res.status(400).json({
                success: false,
                message: "Please provide either an image, a prompt, or both"
            });
        }

        // Check rate limit
        if (!checkRateLimit()) {
            return res.status(429).json({
                success: false,
                message: "Rate limit exceeded. Please try again in a minute.",
                error: "RATE_LIMIT_EXCEEDED"
            });
        }

        let extractedText = "";
        let cloudinaryUrl = "";
        let aiResult = {};

        // Case 1: Only prompt provided (no image)
        if (!imageFile && prompt) {
            console.log("Processing prompt only (no image)...");

            // Check cache
            const cacheKey = `prompt_${prompt.substring(0, 100)}`;
            const cachedResult = cache.get(cacheKey);
            if (cachedResult) {
                console.log("Returning cached result");
                return res.status(200).json({
                    success: true,
                    message: "Prompt analyzed successfully (cached)",
                    data: cachedResult,
                    cached: true
                });
            }

            const aiPrompt = `
            You are an expert tutor. The student has asked the following question or provided the following text:
            
            "${prompt}"
            
            Please analyze this and provide:
            1. If it's a question, provide a detailed answer with explanation
            2. If it's an answer to check, evaluate its correctness and provide feedback
            3. Provide suggestions for better understanding
            
            Format your response as JSON with the following structure:
            {
                "type": "question" or "answer_check",
                "userInput": "the student's text",
                "response": "your detailed response",
                "explanation": "detailed explanation",
                "suggestions": ["helpful suggestions"]
            }
            `;

            try {
                // Use Gemini 2.5 Flash - confirmed working with your API key
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: aiPrompt
                });

                const aiText = response.text;

                try {
                    const jsonText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                    aiResult = JSON.parse(jsonText);
                    // Clean markdown formatting from all text fields
                    aiResult = cleanJsonObject(aiResult);
                } catch (parseError) {
                    aiResult = {
                        type: "text_response",
                        response: cleanMarkdownFormatting(aiText),
                        userInput: prompt
                    };
                }

                // Save to database
                const checkRecord = await Check.create({
                    prompt: prompt,
                    image: "",
                    extractedText: "",
                    result: aiResult
                });

                const responseData = {
                    id: checkRecord._id,
                    analysis: aiResult
                };

                // Cache the result
                cache.set(cacheKey, responseData);

                return res.status(200).json({
                    success: true,
                    message: "Prompt analyzed successfully",
                    data: responseData
                });

            } catch (aiError) {
                console.error("AI Error:", aiError);

                // Handle specific API errors
                if (aiError.message?.includes('quota') ||
                    aiError.message?.includes('429') ||
                    aiError.message?.includes('RESOURCE_EXHAUSTED') ||
                    aiError.status === 429) {
                    return res.status(429).json({
                        success: false,
                        message: "AI service quota exceeded. Please try again later or upgrade your API plan.",
                        error: "QUOTA_EXCEEDED",
                        details: "Daily limit reached for free tier. Consider upgrading to paid plan."
                    });
                }

                if (aiError.message?.includes('API key') || aiError.message?.includes('401')) {
                    return res.status(401).json({
                        success: false,
                        message: "Invalid API key configuration",
                        error: "INVALID_API_KEY"
                    });
                }

                if (aiError.message?.includes('404') || aiError.message?.includes('not found')) {
                    // Try fallback model (2.0 flash exists but might have quota issues)
                    console.log("Trying fallback model...");
                    try {
                        const fallbackResponse = await ai.models.generateContent({
                            model: "gemini-2.0-flash",
                            contents: aiPrompt
                        });

                        const aiText = fallbackResponse.text;

                        try {
                            const jsonText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                            aiResult = JSON.parse(jsonText);
                            // Clean markdown formatting
                            aiResult = cleanJsonObject(aiResult);
                        } catch (parseError) {
                            aiResult = {
                                type: "text_response",
                                response: cleanMarkdownFormatting(aiText),
                                userInput: prompt
                            };
                        }

                        const checkRecord = await Check.create({
                            prompt: prompt,
                            image: "",
                            extractedText: "",
                            result: aiResult
                        });

                        const responseData = {
                            id: checkRecord._id,
                            analysis: aiResult
                        };

                        cache.set(cacheKey, responseData);

                        return res.status(200).json({
                            success: true,
                            message: "Prompt analyzed successfully (using fallback model)",
                            data: responseData
                        });
                    } catch (fallbackError) {
                        return res.status(503).json({
                            success: false,
                            message: "AI model not available. Please check your API key or try again later.",
                            error: "MODEL_NOT_AVAILABLE"
                        });
                    }
                }

                throw aiError; // Re-throw other errors
            }
        }

        // Case 2: Image provided (with or without prompt)
        if (imageFile) {
            console.log("Processing image...");

            // Check cache for image
            const imageCacheKey = `image_${imageFile.originalname}_${prompt || 'default'}`;
            const cachedImageResult = cache.get(imageCacheKey);
            if (cachedImageResult) {
                console.log("Returning cached image result");
                return res.status(200).json({
                    success: true,
                    message: "Image analyzed successfully (cached)",
                    data: cachedImageResult,
                    cached: true
                });
            }

            // Step 1: Extract text from image using OCR
            console.log("Extracting text from image...");
            try {
                const ocrResult = await Tesseract.recognize(
                    imageFile.buffer,
                    'eng',
                    {
                        logger: info => console.log(info.status)
                    }
                );
                extractedText = ocrResult.data.text.trim();
                console.log("Extracted text:", extractedText);
            } catch (ocrError) {
                console.error("OCR Error:", ocrError);
                extractedText = ""; // Continue without OCR if it fails
            }

            // Step 2: Upload image to Cloudinary
            console.log("Uploading to Cloudinary...");
            try {
                cloudinaryUrl = await uploadCloudinary(imageFile.buffer, imageFile.originalname);
                console.log("Cloudinary URL:", cloudinaryUrl);
            } catch (cloudinaryError) {
                console.error("Cloudinary Error:", cloudinaryError);
                cloudinaryUrl = "";
            }

            // Step 3: Analyze with Google AI
            console.log("Analyzing with AI...");

            // Convert buffer to base64 for Gemini
            const imageBase64 = imageFile.buffer.toString('base64');

            // Build AI prompt based on user input
            let aiPrompt;
            if (prompt) {
                aiPrompt = `
                You are an expert tutor. A student has uploaded an image and provided the following instruction:
                
                User's instruction: "${prompt}"
                
                Extracted text from image: "${extractedText}"
                
                Please analyze the image according to the user's instruction and provide a detailed response.
                
                Format your response as JSON with the following structure:
                {
                    "question": "the question identified (if any)",
                    "studentAnswer": "the student's answer (if any)",
                    "isCorrect": true/false (if applicable),
                    "correctAnswer": "the correct answer (if applicable)",
                    "explanation": "detailed explanation",
                    "analysis": "your analysis based on user's instruction",
                    "mistakes": ["list of mistakes if any"],
                    "suggestions": ["helpful suggestions"]
                }
                `;
            } else {
                aiPrompt = `
                You are an expert tutor. A student has submitted an image with their answer to a question.
                
                Extracted text from image: "${extractedText}"
                
                Please analyze the image and:
                1. Identify the question being asked
                2. Review the student's answer
                3. Check if the answer is correct or incorrect
                4. Provide the correct answer with detailed explanation
                5. Point out any mistakes or areas for improvement
                6. Give helpful suggestions for better understanding
                
                Format your response as JSON with the following structure:
                {
                    "question": "the question identified",
                    "studentAnswer": "the student's answer",
                    "isCorrect": true/false,
                    "correctAnswer": "the correct answer",
                    "explanation": "detailed explanation",
                    "mistakes": ["list of mistakes if any"],
                    "suggestions": ["helpful suggestions"]
                }
                `;
            }

            try {
                // Using Gemini 2.5 Flash for image analysis (confirmed working)
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: [
                        {
                            role: "user",
                            parts: [
                                {
                                    inlineData: {
                                        mimeType: imageFile.mimetype,
                                        data: imageBase64
                                    }
                                },
                                {
                                    text: aiPrompt
                                }
                            ]
                        }
                    ]
                });

                const aiText = response.text;

                // Parse AI response
                try {
                    const jsonText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                    aiResult = JSON.parse(jsonText);
                    // Clean markdown formatting from all text fields
                    aiResult = cleanJsonObject(aiResult);
                } catch (parseError) {
                    aiResult = {
                        rawResponse: cleanMarkdownFormatting(aiText),
                        extractedText: extractedText
                    };
                }

                // Step 4: Save to database
                const checkRecord = await Check.create({
                    prompt: prompt || "Check this answer and provide feedback",
                    image: cloudinaryUrl,
                    extractedText: extractedText,
                    result: aiResult
                });

                const responseData = {
                    id: checkRecord._id,
                    imageUrl: cloudinaryUrl,
                    extractedText: extractedText,
                    analysis: aiResult
                };

                // Cache the result
                cache.set(imageCacheKey, responseData);

                return res.status(200).json({
                    success: true,
                    message: "Image analyzed successfully",
                    data: responseData
                });

            } catch (aiError) {
                console.error("AI Error:", aiError);

                // Handle specific API errors
                if (aiError.message?.includes('quota') ||
                    aiError.message?.includes('429') ||
                    aiError.message?.includes('RESOURCE_EXHAUSTED') ||
                    aiError.status === 429) {
                    return res.status(429).json({
                        success: false,
                        message: "AI service quota exceeded. Please try again later or upgrade your API plan.",
                        error: "QUOTA_EXCEEDED",
                        details: "Daily limit reached for free tier. Consider upgrading to paid plan."
                    });
                }

                if (aiError.message?.includes('API key') || aiError.message?.includes('401')) {
                    return res.status(401).json({
                        success: false,
                        message: "Invalid API key configuration",
                        error: "INVALID_API_KEY"
                    });
                }

                if (aiError.message?.includes('404') || aiError.message?.includes('not found')) {
                    // Try fallback model for images
                    console.log("Trying fallback model for image...");
                    try {
                        const fallbackResponse = await ai.models.generateContent({
                            model: "gemini-2.0-flash",
                            contents: [
                                {
                                    role: "user",
                                    parts: [
                                        {
                                            inlineData: {
                                                mimeType: imageFile.mimetype,
                                                data: imageBase64
                                            }
                                        },
                                        {
                                            text: aiPrompt
                                        }
                                    ]
                                }
                            ]
                        });

                        const aiText = fallbackResponse.text;

                        try {
                            const jsonText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                            aiResult = JSON.parse(jsonText);
                            // Clean markdown formatting
                            aiResult = cleanJsonObject(aiResult);
                        } catch (parseError) {
                            aiResult = {
                                rawResponse: cleanMarkdownFormatting(aiText),
                                extractedText: extractedText
                            };
                        }

                        const checkRecord = await Check.create({
                            prompt: prompt || "Check this answer and provide feedback",
                            image: cloudinaryUrl,
                            extractedText: extractedText,
                            result: aiResult
                        });

                        const responseData = {
                            id: checkRecord._id,
                            imageUrl: cloudinaryUrl,
                            extractedText: extractedText,
                            analysis: aiResult
                        };

                        cache.set(imageCacheKey, responseData);

                        return res.status(200).json({
                            success: true,
                            message: "Image analyzed successfully (using fallback model)",
                            data: responseData
                        });
                    } catch (fallbackError) {
                        return res.status(503).json({
                            success: false,
                            message: "AI model not available. Please check your API key or try again later.",
                            error: "MODEL_NOT_AVAILABLE"
                        });
                    }
                }

                throw aiError;
            }
        }

    } catch (error) {
        console.error("Error in checkController:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to process request",
            error: error.message
        });
    }
};

// Get all checks
export const getAllChecks = async (req, res) => {
    try {
        const checks = await Check.find().sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: checks.length,
            data: checks
        });
    } catch (error) {
        console.error("Error in getAllChecks:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch checks",
            error: error.message
        });
    }
};

// Get single check by ID
export const getCheckById = async (req, res) => {
    try {
        const { id } = req.params;
        const check = await Check.findById(id);

        if (!check) {
            return res.status(404).json({
                success: false,
                message: "Check not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: check
        });
    } catch (error) {
        console.error("Error in getCheckById:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch check",
            error: error.message
        });
    }
};

// Delete check
export const deleteCheck = async (req, res) => {
    try {
        const { id } = req.params;
        const check = await Check.findByIdAndDelete(id);

        if (!check) {
            return res.status(404).json({
                success: false,
                message: "Check not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Check deleted successfully"
        });
    } catch (error) {
        console.error("Error in deleteCheck:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete check",
            error: error.message
        });
    }
};