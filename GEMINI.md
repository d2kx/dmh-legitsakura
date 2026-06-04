# GEMINI.md: LLM Developer Guidelines 🌸

Welcome! If you are a Large Language Model (LLM) or coding agent helping to develop **LegitSakura**, this guide outlines critical context, design architectures, code quirks, and patterns used throughout this project to help you write matching code on your first try.

---

## 🗺️ Monorepo Map

- `/backend/src/`
  - `main.ts`: Entry point. Enforces CORS for localhost.
  - `app.controller.ts`: Controller defining `/api/analyze` and `/api/benchmark`. Handles `Multer` file parsing.
  - `analysis.service.ts`: Extracts EXIF and C2PA metadata.
  - `gemini.service.ts`: Prepares LLM prompts, loads base64 image data, feeds extracted metadata context, and requests schema-enforced structured JSON outputs.
- `/frontend/src/`
  - `styles.css`: Root global stylesheet containing theme tokens and classes.
  - `app/`
    - `app.ts` / `app.html` / `app.css`: Root component containing layout, navbar, active router states, and api key check.
    - `app.routes.ts`: Main router paths.
    - `settings.service.ts`: Services settings signals and handles reactive sync with `localStorage`.
    - `settings.ts`: Component managing custom temperature and prompt selections.
    - `analyze.ts`: Single image forensics component with tab dividers.
    - `benchmark.ts`: Batch evaluation page presenting the confusion matrix.

---

## ⚠️ Important Implementation Quirks

### 1. C2PA Parsing Library (`@contentauth/c2pa-node`)
- **Quirk**: Older documentation refers to a `createC2pa()` factory helper. In the modern Node SDK, this is **not** exported. Instead, use the `Reader` class directly:
  ```typescript
  import { Reader } from '@contentauth/c2pa-node';
  
  // Reading a buffer requires passing a SourceBufferAsset object
  const reader = await Reader.fromAsset({ buffer, mimeType });
  if (reader) {
    const manifestStore = reader.json();
    // activeManifest label = manifestStore.active_manifest
    // manifests = manifestStore.manifests
  }
  ```
- **Platform Native**: This package pulls down native `.node` compiled binaries. Always build with standard Node.js targets.

### 2. Gemini Javascript GenAI SDK (`@google/genai`)
- **Quirk**: The older `@google/generative-ai` package is legacy. Use the official modern `@google/genai` library.
  - Client initialization:
    ```typescript
    import { GoogleGenAI } from '@google/genai';
    const ai = new GoogleGenAI({ apiKey });
    ```
  - Structured output schemas must use uppercase types (`type: 'OBJECT'`, `type: 'STRING'`, `type: 'INTEGER'`) under `config.responseSchema`:
    ```typescript
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { inlineData: { mimeType, data: base64Data } },
        { text: promptText }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: yourSchema,
        temperature: temp
      }
    });
    ```

### 3. Angular Standalone Controls (Angular 22)
- **Signals**: Do not use standard RxJS behavior for configuration configurations unless necessary. Wrap parameters inside Signals and update state via `set()` or `update()`.
- **Standalone Component Imports**: Remember to declare basic directives/pipes if you use them in templates:
  - If formatting percentages, add `DecimalPipe` to `imports: [DecimalPipe]` in the component metadata.
  - Standard HTML form elements should handle raw inputs using Signal bindings `[value]="val()"` and `(input)="val.set($event.target.value)"` rather than importing `FormsModule` to avoid template compilation blocks.

### 4. Custom Styling Philosophy
- **Rule**: Avoid utilizing Tailwind CSS or writing utility classes. Make use of standard CSS classes referencing root theme custom variables (e.g. `var(--color-primary)`, `var(--bg-surface-glass)`) mapped inside `/frontend/src/styles.css`.
- **Layouts**: Use Flexbox and Grid layouts. For premium aesthetics, use backdrop filters (`backdrop-filter: blur(16px)`), CSS transitions (`transition: all var(--transition-fast)`), and linear gradients for buttons and gauges.
