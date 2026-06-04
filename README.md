# LegitSakura 🌸

LegitSakura is a dual-factor image authenticity and digital forensics web application. It parses cryptographic provenance signatures (C2PA) and camera EXIF headers, combined with the vision-reasoning capabilities of Google Gemini LLMs, to audit and evaluate whether uploaded images are authentic or manipulated/synthesized (AI-generated, cropped, edited, etc.).

This application is strictly for **research and forensic analysis purposes**.

---

## 🚀 Key Features

1. **Single Image Analysis Dashboard**:
   - Drag-and-drop uploads for immediate audit.
   - Decoupled, progress-tracked pipeline (File load -> C2PA/EXIF Parse -> Gemini Vision Audit).
   - Radial gauges displaying a combined **Legitimacy Score** (0% to 100%).
   - Color-coded warnings and verified badges.
   - Collapsible tabs for the **Forensic Critique** (LLM reasoning), **C2PA Manifests** (chain validation and operations history), and search-filtered **EXIF Headers**.
   
2. **Bulk Benchmarking Suite**:
   - Separate drop-zones for staging arrays of known authentic ("Legit") and manipulated/synthetic ("AI") images.
   - Dynamic threshold configuration slider (deciding classification boundary).
   - High-fidelity **Confusion Matrix** grid showing:
     - True Negatives (TN)
     - False Positives (FP)
     - False Negatives (FN)
     - True Positives (TP)
   - Export reports directly to **JSON** or **CSV** formats.
   
3. **Reactive Settings Management**:
   - Local browser storage caching of Gemini API keys, model selections (Gemini 2.5 Flash, 2.5 Pro, 2.0 Flash Lite, etc.), custom temperature sliders, and system prompt guidelines.
   - Dynamic status indicator badge showing whether a custom API Key is active or the backend environment variable is used.

---

## 🛠️ Technology Stack & Monorepo Structure

The project is organized in a monorepo structure:
- `/backend`: NestJS (Node.js) REST API using TypeScript.
  - `@google/genai`: Official Google GenAI SDK.
  - `@contentauth/c2pa-node`: C2PA metadata reader utilizing native Rust binaries.
  - `exifr`: General EXIF parser.
- `/frontend`: Angular (v22) single-page client.
  - Signals architecture (`signal`, `computed`, `effect`) for state management.
  - Customized CSS layout utilizing CSS custom tokens for animations, metrics, and cards.
  - Google Outfit, Inter, and Material Icon Round fonts.
- `/test-images`: Prepared sample testing files (`legit_sakura.png` and `ai_sakura.png`).

---

## 📦 Getting Started

### Prerequisites
- Node.js v20 or later.
- A Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/).

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. (Optional) Set up an environment variable file `.env` containing your key, or set it via command line:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
4. Start the backend development server:
   ```bash
   npm run start
   ```
   The backend will be running on `http://localhost:3000`.

### Frontend Setup
1. Open a new terminal in the project root and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Angular dev server:
   ```bash
   npm run start
   ```
   Open `http://localhost:4200` in your web browser.

---

## 🧪 Testing and Verification

To verify that the application endpoints are functioning, you can run verification test scripts:
1. Navigate to the project root.
2. In a terminal, execute the single image API test script:
   ```bash
   node .system_generated/logs/../../.gemini/antigravity/brain/<your-session-id>/scratch/test-api.js
   # Or run directly via node:
   node backend/../C:/Users/denni/.gemini/antigravity/brain/cdb9aebd-d15a-4c2c-a8dd-d0df7e69b430/scratch/test-api.js
   ```
3. Execute the batch benchmark test script:
   ```bash
   node C:/Users/denni/.gemini/antigravity/brain/cdb9aebd-d15a-4c2c-a8dd-d0df7e69b430/scratch/test-benchmark.js
   ```
These scripts upload mock images from `/test-images` and print parsed metadata and Gemini client validation checks.