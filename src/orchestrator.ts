import { architectAgent } from "./agents/architect.js";
import { builderAgent } from "./agents/builder.js";
import { auditorAgent } from "./agents/auditor.js";
import fs from "fs-extra";
import path from "path";
import crypto from "crypto";

const OUTPUT_DIR = process.env.OUTPUT_DIR || "./output";

interface ProjectState {
    id: string;
    blueprint: string;
    htmlPath?: string;
    status: "completed" | "failed" | "in_progress";
    auditResults?: any;
}

export class Orchestrator {

    /**
     * Generates a new website project from a user prompt.
     */
    async generate(prompt: string): Promise<ProjectState> {
        const projectId = crypto.randomUUID();
        const projectDir = path.join(OUTPUT_DIR, projectId);

        console.log(`[Orchestrator] Starting new project: ${projectId}`);

        // Step 1: Architect
        console.log(`[Orchestrator] generating blueprint...`);
        const blueprint = await architectAgent.generateBlueprint(prompt);

        // Save Blueprint
        await fs.ensureDir(projectDir);
        await fs.writeFile(path.join(projectDir, "blueprint.md"), blueprint);

        return this.runBuildLoop(projectId, projectDir, blueprint);
    }

    /**
     * Modifies an existing project based on new user feedback.
     */
    async modify(previousProjectId: string, modificationPrompt: string): Promise<ProjectState> {
        const projectDir = path.join(OUTPUT_DIR, previousProjectId);
        const blueprintPath = path.join(projectDir, "blueprint.md");
        const indexPath = path.join(projectDir, "index.html");

        if (!await fs.pathExists(blueprintPath)) {
            throw new Error(`Project ${previousProjectId} not found.`);
        }

        const previousBlueprint = await fs.readFile(blueprintPath, "utf-8");
        let existingHtml = undefined;
        if (await fs.pathExists(indexPath)) {
            existingHtml = await fs.readFile(indexPath, "utf-8");
        }

        console.log(`[Orchestrator] Modifying project: ${previousProjectId}`);

        // Architect generates updated blueprint with HTML context
        const updatedBlueprint = await architectAgent.generateBlueprint(
            `Based on the previous blueprint and existing HTML, apply this modification: ${modificationPrompt}`,
            [previousBlueprint],
            existingHtml
        );

        // Save Updated Blueprint
        await fs.writeFile(path.join(projectDir, "blueprint.md"), updatedBlueprint);

        return this.runBuildLoop(previousProjectId, projectDir, updatedBlueprint, existingHtml);
    }

    /**
     * Core Self-Correcting Build Loop
     */
    private async runBuildLoop(projectId: string, projectDir: string, blueprint: string, existingHtml?: string): Promise<ProjectState> {
        let feedback: string | undefined;
        let indexHtmlPath = "";
        const MAX_RETRIES = 3;

        for (let i = 0; i < MAX_RETRIES; i++) {
            console.log(`[Orchestrator] Build iteration ${i + 1}/${MAX_RETRIES}`);

            try {
                // Step 2: Builder
                // If it's a retry, we construct specific feedback
                let effectiveBlueprint = blueprint;
                if (feedback) {
                    effectiveBlueprint = `
                Your previous build failed these specific checks:
                ${feedback}
                
                Focus strictly on fixing these errors while keeping the rest of the code intact.
                `;
                }

                indexHtmlPath = await builderAgent.executeBuild(effectiveBlueprint, projectDir, feedback);
                const htmlContent = await fs.readFile(indexHtmlPath, "utf-8");

                // Step 3: Auditor
                console.log(`[Orchestrator] Auditing build...`);
                const auditResult = await auditorAgent.auditCode(htmlContent, blueprint);

                console.log(`[Orchestrator] Audit Status: ${auditResult.status}`);

                if (auditResult.status === "PASS") {
                    console.log(`[Orchestrator] Project ${projectId} completed successfully.`);
                    return {
                        id: projectId,
                        blueprint,
                        htmlPath: indexHtmlPath,
                        status: "completed",
                        auditResults: auditResult
                    };
                }

                // If FAIL, prepare feedback for next loop
                feedback = auditResult.critical_issues.join("\n- ");
                console.log(`[Orchestrator] Build failed audit. Retrying with feedback: \n${feedback}`);

            } catch (error) {
                console.error(`[Orchestrator] Error in build loop iteration ${i + 1}:`, error);
            }
        }

        // If we exit the loop, we failed.
        // HARDENING: Save as index_FAILED_AUDIT.html
        const failedPath = path.join(projectDir, "index_FAILED_AUDIT.html");
        if (fs.existsSync(indexHtmlPath)) {
            await fs.rename(indexHtmlPath, failedPath);
        }

        console.warn(`[Orchestrator] Project ${projectId} reached max retries. Saved as index_FAILED_AUDIT.html`);
        return {
            id: projectId,
            blueprint,
            htmlPath: failedPath,
            status: "failed",
            auditResults: { status: "FAIL", critical_issues: ["Max retries reached. Last feedback: " + feedback] }
        };
    }
}
