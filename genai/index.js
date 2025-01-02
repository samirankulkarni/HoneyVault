import express from "express";
import fs from "fs";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const PORT = 44518;

app.use(cors());

function extractBracketContent(inputString) {
    // Find the first opening bracket and the last closing bracket
    const startIndex = inputString.indexOf('[');
    const endIndex = inputString.lastIndexOf(']');
    
    // If brackets are not found, return an empty string
    if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
        return '';
    }

    // Extract and return the content inside the brackets
    return inputString.slice(startIndex, endIndex + 1);
}

// Initialize Google Generative AI
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("GEMINI_API_KEY environment variable is not set!");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

// Middleware to log details to server_logs.txt
function logRequestDetails(req, res, next) {
    const logFilePath = "./genai_server_logs.txt";

    const timestamp = new Date().toISOString();
    const method = req.method;
    const path = req.originalUrl;
    const queryParams = JSON.stringify(req.query);
    const ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];
    const hostname = req.hostname;

    // Log entry
    const logEntry = `
[${timestamp}]
Method: ${method}
Path: ${path}
Query Params: ${queryParams}
IP Address: ${ipAddress}
User Agent: ${userAgent}
Hostname: ${hostname}
-------------------------------------------------------
`;

    // Append to the log file
    fs.appendFile(logFilePath, logEntry, (err) => {
        if (err) console.error("Failed to write log:", err);
    });

    next(); // Continue to the next middleware/route handler
}

app.use(logRequestDetails);


app.get("/api/list", async (req, res) => {
    const { secret, cred } = req.query;

    // Validate query parameters
    if (!secret || !cred) {
        return res.status(400).send("Please provide both 'cred' and 'secret' parameters.");
    }

    try {
        // Set system instruction dynamically based on gender
        const systemInstructionString = `You are user and you have a credential
        whose password you remember vaguely, however you know credential name and vague password`;

        // Get the generative model with the updated system instruction
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            systemInstruction: systemInstructionString,
        });

        const prompt = `Credential name is ${cred}, you remember vague password as ${secret}. Generate
        10 likey passwords based on information. Give it in form of string array. dont give any additional text,
        please only give array.`;
        const result = await model.generateContent(prompt);


        const genai_res = result.response.text();
        const res_to_send = extractBracketContent(genai_res);

        res.status(200).send(res_to_send);

    } catch (error) {
        console.error("Error generating story:", error);
        res.status(500).send("An error occurred while generating the story.");
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
