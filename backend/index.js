// test-available-models.js
// Run this to check which models work with your API key

import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API
});

async function testModels() {
    const modelsToTest = [
        "gemini-pro",
        "gemini-pro-vision",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
        "gemini-2.0-flash",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite-preview-06-17"
    ];

    console.log("🔍 Testing available models with your API key...\n");
    console.log("API Key:", process.env.GOOGLE_API ? "Found ✅" : "Missing ❌");
    console.log("=".repeat(60) + "\n");

    for (const modelName of modelsToTest) {
        try {
            console.log(`Testing: ${modelName}`);
            const response = await ai.models.generateContent({
                model: modelName,
                contents: "Hello"
            });

            const text = response.text;
            console.log(`✅ ${modelName} - WORKS`);
            console.log(`   Response: ${text.substring(0, 50)}...`);
        } catch (error) {
            if (error.status === 404) {
                console.log(`❌ ${modelName} - NOT FOUND (404)`);
            } else if (error.status === 429) {
                console.log(`⚠️  ${modelName} - QUOTA EXCEEDED (but exists)`);
            } else if (error.status === 401) {
                console.log(`❌ ${modelName} - INVALID API KEY`);
            } else {
                console.log(`❌ ${modelName} - ERROR: ${error.message}`);
            }
        }
        console.log("");
    }

    console.log("=".repeat(60));
    console.log("\n📊 Recommendation:");
    console.log("Use models marked with ✅ in your controller");
    console.log("\nFor text: Use gemini-pro or gemini-1.5-flash");
    console.log("For images: Use gemini-1.5-flash or gemini-pro-vision");
}

testModels().catch(error => {
    console.error("Fatal error:", error.message);
    console.log("\n❌ Make sure:");
    console.log("1. You have GOOGLE_API in your .env file");
    console.log("2. Your API key is valid");
    console.log("3. You've installed @google/genai: npm install @google/genai");
});