import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

export const architectAgent = {
    /**
     * Generates a detailed technical blueprint for the website based on user requirements.
     * The blueprint is designed to instruct a developer (or builder agent) to create a single-file solution.
     */
    async generateBlueprint(userPrompt: string, history: string[] = [], existingHtml?: string): Promise<string> {

        let systemPrompt = `
      You are a Principal Software Architect.
      Your goal is to design a complete, production-ready website based on the user's request.
      
      CRITICAL REQUIREMENT:
      The output must be a detailed technical specification (Blueprint) for a Developer.
      You MUST strictly instruct the Developer to generate a SINGLE 'index.html' file.
      All CSS must be embedded in <style> tags.
      All JavaScript must be embedded in <script> tags.
      External assets (images) should be fast, reliable placeholders (like unsplash source) or CDNs.
      
      The Blueprint should include:
      1. Project Structure (Single File 'index.html')
      2. Core Features & Requirements
      3. Design System (Colors, Typography, Layout - instructions for CSS)
      4. Functional Logic (Instructions for JS)
      5. Step-by-Step Implementation Guide
      
      Ensure the design instructions are high-quality, modern, and responsive.
    `;

        if (existingHtml) {
            systemPrompt += `
      
      CONTEXT UPDATE:
      You are updating an existing website. 
      READ the provided HTML content in the user message history.
      ONLY output a full updated Blueprint that preserves the existing features while applying the new user request.
      DO NOT output a diff. Output the FULL technical specification for the NEW state of the file.
      `;
        }

        const chatHistory = history.map(h => ({ role: "user", parts: [{ text: h }] }));

        // Inject existing HTML into history if provided (as the state before the request)
        if (existingHtml) {
            chatHistory.push({
                role: "user",
                parts: [{ text: `EXISTING HTML CONTENT:\n\`\`\`html\n${existingHtml}\n\`\`\`` }]
            });
        }

        const chat = model.startChat({
            history: chatHistory,
            systemInstruction: systemPrompt,
        });

        const result = await chat.sendMessage(userPrompt);
        const response = result.response.text();

        return response;
    }
};
