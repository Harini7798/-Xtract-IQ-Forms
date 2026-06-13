const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
require('dotenv').config();

/**
 * Azure OCR API configuration
 */
const AZURE_ENDPOINT = process.env.AZURE_ENDPOINT;
const AZURE_API_KEY = process.env.AZURE_API_KEY;

if (!AZURE_ENDPOINT || !AZURE_API_KEY) {
    console.error('ERROR: Azure credentials not found in environment variables');
    console.error('Please ensure .env file has AZURE_ENDPOINT and AZURE_API_KEY set');
}

/**
 * Extracts text from an image using Azure's OCR API
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<string>} - Extracted text from the image
 * @throws {Error} If Azure OCR fails or times out
 */
async function extractTextWithAzure(imagePath) {
    const imageData = fs.readFileSync(imagePath);
    const url = `${AZURE_ENDPOINT.replace(/\/$/, '')}/vision/v3.2/read/analyze`;
    const response = await axios.post(url, imageData, {
        headers: {
            'Ocp-Apim-Subscription-Key': AZURE_API_KEY,
            'Content-Type': 'application/octet-stream',
        },
    });
    const operationLocation = response.headers['operation-location'];
    let result = null;

    // Poll for results (max 15 seconds)
    for (let i = 0; i < 15; i++) {
        await new Promise(res => setTimeout(res, 1000));
        const resultResponse = await axios.get(operationLocation, {
            headers: { 'Ocp-Apim-Subscription-Key': AZURE_API_KEY },
        });
        if (resultResponse.data.status === 'succeeded') {
            result = resultResponse.data.analyzeResult.readResults
                .map(page => page.lines.map(line => line.text).join('\n'))
                .join('\n');
            break;
        }
        if (resultResponse.data.status === 'failed') {
            throw new Error('Azure OCR failed');
        }
    }
    if (!result) throw new Error('Azure OCR did not complete in time');
    return result;
}

/**
 * Converts a PDF file to JPEG images (one per page) using pdftoppm command
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Promise<{images: string[], outputDir: string}>} - Array of image paths and output directory
 * @throws {Error} If no images are generated
 */
async function pdfToImages(pdfPath) {
    const outputDir = path.join(path.dirname(pdfPath), path.basename(pdfPath, path.extname(pdfPath)) + '_images');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    
    const outputPrefix = path.join(outputDir, 'page');
    
    try {
        // Use pdftoppm command directly (works on Linux with poppler-utils)
        // -jpeg: output format
        // -r 300: resolution 300 DPI
        const command = `pdftoppm -jpeg -r 300 "${pdfPath}" "${outputPrefix}"`;
        console.log('Converting PDF to images:', command);
        
        await execPromise(command);
        
        // Get all generated images
        const images = fs.readdirSync(outputDir)
            .filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg'))
            .sort() // Sort to maintain page order
            .map(f => path.join(outputDir, f));
        
        if (images.length === 0) {
            throw new Error('No images generated from PDF');
        }
        
        console.log(`✓ Generated ${images.length} images from PDF`);
        return { images, outputDir };
    } catch (error) {
        console.error('PDF conversion error:', error.message);
        throw new Error(`Failed to convert PDF to images: ${error.message}`);
    }
}

/**
 * Groq AI API configuration for text structuring
 */
const API_KEY = process.env.GROQ_API_KEY;
const API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

if (!API_KEY) {
    console.error('ERROR: GROQ_API_KEY not found in environment variables');
    console.error('Please ensure .env file exists in backend directory with GROQ_API_KEY set');
}

/**
 * Extracts JSON from AI response text
 * @param {string} text - AI response text
 * @returns {Object|null} - Parsed JSON or null if parsing fails
 */
function extractJsonFromText(text) {
    if (!text) return null;
    
    // 1. Try to parse the entire text as JSON (if model returns pure JSON)
    try {
        const parsed = JSON.parse(text);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
    } catch (e) {}
    
    // 2. Try to extract JSON from markdown code block (```json ... ```)
    const jsonCodeBlock = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonCodeBlock && jsonCodeBlock[1]) {
        try { return JSON.parse(jsonCodeBlock[1]); } catch (e) {}
    }
    
    // 3. Try to extract JSON from any code block (``` ... ```)
    const codeBlockMatch = text.match(/```[\s\S]*?(\{[\s\S]*?\})[\s\S]*?```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
        try { return JSON.parse(codeBlockMatch[1]); } catch (e) {}
    }
    
    // 4. Try to extract the first JSON object found in the text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try { return JSON.parse(jsonMatch[0]); } catch (e) {}
    }
    
    return null;
}

/**
 * Processes extracted text with Groq AI to structure it into JSON format
 * @param {string} text - Raw text to process
 * @param {boolean} retry - Whether this is a retry attempt
 * @returns {Promise<Object>} - Structured data or error object
 */
async function processTextWithAI(text, retry = true) {
    try {
        const requestBody = {
            model: "llama-3.3-70b-versatile",  // Latest and most capable Groq model
            messages: [
                {
                    role: "system",
                    content: `You are an AI trained to analyze and structure extracted text from forms. Extract key-value pairs from the given text and organize them into valid JSON format.

The text may contain OCR artifacts like symbols, extra whitespace, or misread characters. Your tasks:
1. Identify meaningful key-value pairs (ignore OCR noise)
2. Standardize field names (e.g., "Full Name", "Email Address", "Phone Number")
3. Clean and format values appropriately
4. Return ONLY valid JSON - no markdown, no explanations, no additional text

Example output format:
{
  "Full Name": "John Doe",
  "Email Address": "john@example.com",
  "Phone Number": "1234567890"
}`
                },
                {
                    role: "user",
                    content: `Extract and structure the data from this OCR text:\n\n${text}`
                }
            ],
            temperature: 0.3,  // Lower for more consistent structured output
            max_tokens: 2048,  // Increased for larger forms
            top_p: 1,
            stream: false
        };

        const requestHeaders = {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        };

        console.log('Sending request to Groq API...');
        const response = await axios.post(API_ENDPOINT, requestBody, { headers: requestHeaders });
        console.log('✓ Groq API response received');
        
        try {
            let aiResponse = response.data.choices[0].message.content;
            console.log('Raw AI Response:', aiResponse.substring(0, 200) + '...');
            
            const extracted = extractJsonFromText(aiResponse);
            if (extracted) {
                console.log('✓ Successfully extracted JSON data');
                return extracted;
            }
            
            if (retry) {
                console.warn('⚠ Groq response not in JSON format, retrying once...');
                return await processTextWithAI(text, false);
            }
            
            console.error('✗ Failed to extract JSON after retry');
            return {
                raw_text: text,
                structured_data: aiResponse,
                error: "Response was not in JSON format"
            };
        } catch (parseError) {
            if (retry) {
                console.warn('⚠ Groq response parse error, retrying once...');
                return await processTextWithAI(text, false);
            }
            
            return {
                raw_text: text,
                structured_data: response.data.choices[0].message.content,
                error: "Response was not in JSON format"
            };
        }
    } catch (error) {
        console.error('✗ API Processing Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
        throw new Error('Failed to process text with AI model: ' + error.message);
    }
}

/**
 * Main function to extract and structure text from an image
 * @param {string} filePath - Path to the image file
 * @returns {Promise<Object>} - Structured data from the image
 */
async function extractTextFromImage(filePath) {
    const rawText = await extractTextWithAzure(filePath);
    return processTextWithAI(rawText);
}

/**
 * Main function to extract and structure text from a scanned PDF
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Promise<Object>} - Structured data from the PDF
 */
async function extractTextFromScannedPDF(pdfPath) {
    const { images, outputDir } = await pdfToImages(pdfPath);
    let allText = '';
    
    // Process each page
    for (const img of images) {
        const text = await extractTextWithAzure(img);
        allText += text + '\n';
    }
    
    // Clean up temporary images
    for (const img of images) {
        if (fs.existsSync(img)) fs.unlinkSync(img);
    }
    if (fs.existsSync(outputDir)) fs.rmdirSync(outputDir, { recursive: true });
    
    return processTextWithAI(allText);
}

module.exports = {
    extractTextFromImage,
    extractTextFromScannedPDF
};
