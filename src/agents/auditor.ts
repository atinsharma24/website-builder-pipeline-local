import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Enforce JSON output schema
const schema = {
    description: "Audit result of the generated code",
    type: SchemaType.OBJECT,
    properties: {
        status: {
            type: SchemaType.STRING,
            description: "Overall status of the audit. Must be 'PASS' or 'FAIL'.",
            enum: ["PASS", "FAIL"]
        },
        critical_issues: {
            type: SchemaType.ARRAY,
            description: "List of critical issues that caused the failure. Empty if PASS.",
            items: {
                type: SchemaType.STRING
            }
        }
    },
    required: ["status", "critical_issues"]
};

const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro",
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema
    }
});

export const auditorAgent = {
    /**
     * Audits the generated HTML content against the original requirements.
     * Returns a structured JSON result indicating Pass/Fail status.
     */
    async auditCode(htmlContent: string, originalRequirements: string): Promise<{ status: "PASS" | "FAIL", critical_issues: string[] }> {
        const prompt = `
      You are a Senior QA Engineer and Code Auditor.
      Your task is to verify if the generated HTML code meets the original requirements and is production-ready.
      
      ORIGINAL REQUIREMENTS:
      "${originalRequirements}"
      
      GENERATED CODE (HTML):
      ${htmlContent}
      
      AUDIT CRITERIA:
      1. Does the code fulfill the core user requirements?
      2. Is it a SINGLE 'index.html' file with embedded CSS/JS? (Critial)
      3. Are there any broken syntax or obvious runtime errors?
      4. Is the design consistent with a modern, high-quality standard?
      
      Return your assessment in the specified JSON format.
      If verification fails, list specific, actionable 'critical_issues' for the builder to fix.
    `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        try {
            return JSON.parse(responseText);
        } catch (e) {
            console.error("[Auditor] Failed to parse JSON response:", responseText);
            // Fallback for safety
            return { status: "FAIL", critical_issues: ["Auditor produced invalid JSON output."] };
        }
    }
};
