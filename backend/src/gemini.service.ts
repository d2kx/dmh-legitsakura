import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';

export interface AnalysisResponse {
  legitimacyScore: number;
  summary: string;
  analysisDetails: string;
  detectedAnomalies: string[];
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  private getClient(customApiKey?: string): GoogleGenAI {
    const apiKey = customApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Gemini API key is not configured. Please set the GEMINI_API_KEY environment variable or provide your key in the settings.',
      );
    }
    return new GoogleGenAI({ apiKey });
  }

  async analyzeImage(
    buffer: Buffer,
    mimeType: string,
    metadata: { exif: any; c2pa: any },
    options: {
      model?: string;
      customPrompt?: string;
      temperature?: number;
      apiKey?: string;
    } = {},
  ): Promise<AnalysisResponse> {
    const model = options.model || 'gemini-2.5-flash';
    const temperature = options.temperature ?? 0.2;
    const ai = this.getClient(options.apiKey);

    const base64Image = buffer.toString('base64');

    const defaultPrompt = `
You are an expert digital forensics examiner. Your task is to analyze the uploaded image and its extracted metadata (EXIF and C2PA) to evaluate whether it is an original, authentic camera photo or if it is manipulated (edited, processed, synthesized, AI-generated, cropped, watermarked, etc.).

Analyze the image based on two dimensions:
1. **Metadata Audit**: Review the provided EXIF and C2PA metadata. Look for signs of manipulation: editing software traces (e.g. Photoshop), known AI generator signatures, missing or stripped headers, or discrepancies in creation dates. If C2PA metadata is present, check the claim generator and actions history.
2. **Visual Audit**: Examine the visual details of the image. Look for compression artifacts, anomalous lighting, unrealistic text, cloning, anatomical inconsistencies, edge blending issues, or AI-signature styling (like overly smooth textures).
3. **Cross-Referencing**: Check if the visual properties match the metadata claims (e.g., does it look like a photo taken on the device and settings claimed in EXIF?).

Extracted EXIF Metadata:
\`\`\`json
${JSON.stringify(metadata.exif, null, 2)}
\`\`\`

Extracted C2PA Metadata:
\`\`\`json
${JSON.stringify(metadata.c2pa, null, 2)}
\`\`\`

Based on your examination, compute a legitimacyScore from 0 (definitely fake/synthesized/heavily manipulated) to 100 (definitely an authentic, unmodified camera photo taken in the real world).
    `;

    const userPrompt = options.customPrompt
      ? `${options.customPrompt}\n\nMetadata Context:\nEXIF: ${JSON.stringify(metadata.exif)}\nC2PA: ${JSON.stringify(metadata.c2pa)}`
      : defaultPrompt;

    const schema = {
      type: 'OBJECT',
      properties: {
        legitimacyScore: {
          type: 'INTEGER',
          description:
            'Authenticity confidence score, from 0 (definitely manipulated/synthesized) to 100 (definitely original, untouched camera photo).',
        },
        summary: {
          type: 'STRING',
          description:
            'A brief 1-2 sentence verdict summarizing your findings.',
        },
        analysisDetails: {
          type: 'STRING',
          description:
            'Detailed analysis report in Markdown format explaining visual and metadata findings, anomalies found, and reasons for the final score.',
        },
        detectedAnomalies: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description:
            'List of key anomalies or flags detected (e.g., "Photoshop editing detected in metadata", "AI textures in background", "No EXIF camera metadata present").',
        },
      },
      required: [
        'legitimacyScore',
        'summary',
        'analysisDetails',
        'detectedAnomalies',
      ],
    };

    try {
      this.logger.log(`Calling Gemini API using model: ${model}`);

      const response = await ai.models.generateContent({
        model: model,
        contents: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          },
          { text: userPrompt },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: temperature,
        },
      });

      if (!response.text) {
        throw new Error('Received empty response from Gemini API');
      }

      const parsed: AnalysisResponse = JSON.parse(response.text);
      return parsed;
    } catch (error) {
      this.logger.error(`Error during Gemini Analysis: ${error.message}`);
      throw new Error(`Gemini service analysis failed: ${error.message}`);
    }
  }
}
