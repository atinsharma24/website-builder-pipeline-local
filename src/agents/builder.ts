import { execa } from "execa";
import fs from "fs-extra";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

export const builderAgent = {
    /**
     * Executes the build process using a local agent (aider) via the CLI.
     * 
     * @param blueprint The technical specification to build.
     * @param workingDir The directory where the build should happen.
     * @param feedback Optional feedback from a previous failed audit to correct issues.
     * @returns The absolute path to the generated index.html.
     */
    async executeBuild(blueprint: string, workingDir: string, feedback?: string): Promise<string> {
        // Ensure working directory exists
        await fs.ensureDir(workingDir);

        let instruction = `
      Here is the architectural blueprint for the website you need to build.
      
      BLUEPRINT:
      ${blueprint}
      
      STRICT INSTRUCTION:
      Generate a SINGLE file named 'index.html' in the current directory.
      It must contain ALL code (HTML, CSS, JS).
      Do not create separate .css or .js files.
    `;

        if (feedback) {
            instruction += `
        
        CRITICAL FEEDBACK FROM PREVIOUS AUDIT (FIX THESE ISSUES):
        ${feedback}
      `;
        }

        // Command to run the local agent (Aider)
        // HARDENING: Using flags for non-interactive, cleaner execution.
        // 1. Load model from env (default: ollama/deepseek-coder-v2)
        const model = process.env.LOCAL_MODEL || "ollama/deepseek-coder-v2";

        // 2. Construct Args
        // - --model: Explicitly set the local model
        // - --yes: Always say yes to changes
        // - --no-auto-commits: Don't git noise
        // - --message: The prompt
        // - index.html: Explicit target file

        const args = [
            "--model", model,
            "--yes",
            "--no-auto-commits",
            "--message", instruction,
            "index.html"
        ];

        console.log(`[Builder] Starting build in ${workingDir} using model ${model}...`);

        try {
            // HARDENING: stdio 'inherit' to visualize progress/errors in real-time.
            await execa("aider", args, {
                cwd: workingDir,
                stdio: "inherit",
                env: {
                    ...process.env,
                    // Ensure no interactive prompts block execution
                    CI: "true"
                }
            });

            const indexPath = path.join(workingDir, "index.html");

            if (!fs.existsSync(indexPath)) {
                throw new Error("Builder failed: index.html was not found after execution.");
            }

            console.log(`[Builder] Build complete. Output at ${indexPath}`);
            return indexPath;

        } catch (error) {
            console.error("[Builder] Error execution failed:", error);
            throw error;
        }
    }
};
