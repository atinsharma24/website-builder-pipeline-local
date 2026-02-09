# Multi-Agent Website Builder Pipeline

A production-ready AI pipeline that generates single-file websites using a self-correcting loop.

## Architecture

1.  **Architect (Gemini 1.5 Pro)**: Creates a detailed technical blueprint.
2.  **Builder (Aider via Execa)**: Generates the code (`index.html`) locally.
3.  **Auditor (Gemini 1.5 Pro)**: Reviews the code against requirements.
4.  **Orchestrator**: Manages the retry loop. If the Auditor fails the build, the Builder is tasked to fix it.

## Prerequisites

1.  **Node.js** (v18+)
2.  **Aider**: The builder agent relies on `aider` being installed and available in your PATH.
    ```bash
    pip install aider-chat
    ```
3.  **Google Gemini API Key**: Get one from AI Studio.

## Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Setup environment variables:
    ```bash
    cp .env.example .env
    # Edit .env and add your GEMINI_API_KEY
    ```

## Usage

Start the server:
```bash
npm run dev
```

### Endpoints

**1. Generate a Website**
```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A modern portfolio website for a photographer with a dark theme"}'
```

**2. Modify an Existing Project**
```bash
curl -X POST http://localhost:3000/modify \
  -H "Content-Type: application/json" \
  -d '{"previous_project_id": "YOUR_PROJECT_ID", "modification_prompt": "Change the background to white"}'
```

## Output

Generated websites are saved in the `output/<project-id>/` directory.
