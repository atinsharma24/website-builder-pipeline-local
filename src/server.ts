import Fastify from "fastify";
import { z } from "zod";
import dotenv from "dotenv";
import fs from "fs-extra";
import path from "path";
import { Orchestrator } from "./orchestrator.js";

dotenv.config();

const fastify = Fastify({
    logger: true
});

const orchestrator = new Orchestrator();
const OUTPUT_DIR = process.env.OUTPUT_DIR || "./output";

// HARDENING: Simple mutex/lock variable
let isBuilding = false;

// Validation Schemas
const GenerateSchema = z.object({
    prompt: z.string().min(5, "Prompt must be at least 5 characters long")
});

const ModifySchema = z.object({
    previous_project_id: z.string().uuid("Invalid Project ID format"),
    modification_prompt: z.string().min(5)
});

// Middleware for concurrency check
const checkConcurrency = (req: any, reply: any, done: any) => {
    if (isBuilding) {
        reply.status(503).send({
            error: "Service Unavailable",
            message: "The builder is currently busy with another request. Please try again later."
        });
        return;
    }
    done();
};

// Routes
fastify.post("/generate", { preHandler: checkConcurrency }, async (request, reply) => {
    try {
        isBuilding = true; // Lock
        const body = GenerateSchema.parse(request.body);
        const result = await orchestrator.generate(body.prompt);
        return reply.status(200).send(result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return reply.status(400).send({ error: "Validation Error", details: error.errors });
        }
        request.log.error(error);
        return reply.status(500).send({ error: "Internal Server Error", message: (error as Error).message });
    } finally {
        isBuilding = false; // Release Lock
    }
});

fastify.post("/modify", { preHandler: checkConcurrency }, async (request, reply) => {
    try {
        isBuilding = true; // Lock
        const body = ModifySchema.parse(request.body);
        const result = await orchestrator.modify(body.previous_project_id, body.modification_prompt);
        return reply.status(200).send(result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return reply.status(400).send({ error: "Validation Error", details: error.errors });
        }
        request.log.error(error);
        return reply.status(500).send({ error: "Internal Server Error", message: (error as Error).message });
    } finally {
        isBuilding = false; // Release Lock
    }
});

fastify.get("/health", async () => {
    return { status: "ok", busy: isBuilding };
});

// Start Server
const start = async () => {
    try {
        // Safety: Explicity ensure output directory exists on startup
        await fs.ensureDir(OUTPUT_DIR);

        const PORT = process.env.PORT || 3000;
        await fastify.listen({ port: Number(PORT), host: "0.0.0.0" });
        console.log(`Server listening on http://0.0.0.0:${PORT}`);
        console.log(`Output directory confirmed at: ${path.resolve(OUTPUT_DIR)}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
