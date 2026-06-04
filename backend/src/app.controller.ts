import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Body,
  Headers,
  BadRequestException,
  Get,
} from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { AnalysisService } from './analysis.service';
import { GeminiService, AnalysisResponse } from './gemini.service';

interface BenchmarkResultItem {
  filename: string;
  expected: 'legit' | 'manipulated';
  predicted: 'legit' | 'manipulated';
  score: number;
  isCorrect: boolean;
  summary: string;
  detectedAnomalies: string[];
  error?: string;
}

@Controller('api')
export class AppController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly geminiService: GeminiService,
  ) {}

  @Get('health')
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Post('analyze')
  @UseInterceptors(FileInterceptor('file'))
  async analyzeImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { model?: string; customPrompt?: string; temperature?: string },
    @Headers('x-gemini-api-key') customApiKey?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No image file provided.');
    }

    const mimeType = file.mimetype;
    const buffer = file.buffer;

    // 1. Extract EXIF
    const exif = await this.analysisService.extractExif(buffer);

    // 2. Extract C2PA
    const c2pa = await this.analysisService.extractC2pa(buffer, mimeType);

    const temp = body.temperature ? parseFloat(body.temperature) : undefined;

    // 3. Query Gemini LLM
    try {
      const llmResult = await this.geminiService.analyzeImage(
        buffer,
        mimeType,
        { exif, c2pa },
        {
          model: body.model,
          customPrompt: body.customPrompt,
          temperature: temp,
          apiKey: customApiKey,
        },
      );

      return {
        filename: file.originalname,
        mimeType,
        sizeBytes: file.size,
        exif,
        c2pa,
        analysis: llmResult,
      };
    } catch (error) {
      return {
        filename: file.originalname,
        mimeType,
        sizeBytes: file.size,
        exif,
        c2pa,
        error: error.message,
      };
    }
  }

  @Post('benchmark')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'legitImages', maxCount: 30 },
      { name: 'manipulatedImages', maxCount: 30 },
    ]),
  )
  async runBenchmark(
    @UploadedFiles()
    files: {
      legitImages?: Express.Multer.File[];
      manipulatedImages?: Express.Multer.File[];
    },
    @Body()
    body: {
      model?: string;
      customPrompt?: string;
      temperature?: string;
      threshold?: string;
    },
    @Headers('x-gemini-api-key') customApiKey?: string,
  ) {
    const legitList = files?.legitImages || [];
    const manipulatedList = files?.manipulatedImages || [];

    if (legitList.length === 0 && manipulatedList.length === 0) {
      throw new BadRequestException(
        'Please upload at least one image in either legitImages or manipulatedImages fields.',
      );
    }

    const threshold = body.threshold ? parseInt(body.threshold, 10) : 50;
    const model = body.model;
    const customPrompt = body.customPrompt;
    const temp = body.temperature ? parseFloat(body.temperature) : undefined;

    const results: BenchmarkResultItem[] = [];

    // Helper for analysis
    const analyzeAndMap = async (
      file: Express.Multer.File,
      expected: 'legit' | 'manipulated',
    ): Promise<BenchmarkResultItem> => {
      try {
        const exif = await this.analysisService.extractExif(file.buffer);
        const c2pa = await this.analysisService.extractC2pa(file.buffer, file.mimetype);

        const analysis: AnalysisResponse = await this.geminiService.analyzeImage(
          file.buffer,
          file.mimetype,
          { exif, c2pa },
          { model, customPrompt, temperature: temp, apiKey: customApiKey },
        );

        // Score threshold: score >= threshold -> legit, score < threshold -> manipulated
        const predicted: 'legit' | 'manipulated' =
          analysis.legitimacyScore >= threshold ? 'legit' : 'manipulated';

        return {
          filename: file.originalname,
          expected,
          predicted,
          score: analysis.legitimacyScore,
          isCorrect: predicted === expected,
          summary: analysis.summary,
          detectedAnomalies: analysis.detectedAnomalies,
        };
      } catch (error) {
        return {
          filename: file.originalname,
          expected,
          predicted: expected === 'legit' ? 'manipulated' : 'legit', // inverted/default wrong prediction on error
          score: 0,
          isCorrect: false,
          summary: `Analysis failed: ${error.message}`,
          detectedAnomalies: [],
          error: error.message,
        };
      }
    };

    // Run sequentially to respect rate limits, but cleanly
    for (const file of legitList) {
      const res = await analyzeAndMap(file, 'legit');
      results.push(res);
    }

    for (const file of manipulatedList) {
      const res = await analyzeAndMap(file, 'manipulated');
      results.push(res);
    }

    // Compute metrics
    // Positive Class = Manipulated (fraud/anomaly detection)
    let tp = 0; // True Positive: Expected manipulated, Predicted manipulated
    let fp = 0; // False Positive: Expected legit, Predicted manipulated
    let tn = 0; // True Negative: Expected legit, Predicted legit
    let fn = 0; // False Negative: Expected manipulated, Predicted legit
    let successfulCount = 0;

    for (const res of results) {
      if (res.error) continue;
      successfulCount++;
      if (res.expected === 'manipulated' && res.predicted === 'manipulated') tp++;
      if (res.expected === 'legit' && res.predicted === 'manipulated') fp++;
      if (res.expected === 'legit' && res.predicted === 'legit') tn++;
      if (res.expected === 'manipulated' && res.predicted === 'legit') fn++;
    }

    const totalProcessed = results.length;
    const totalCorrect = results.filter((r) => r.isCorrect).length;
    const accuracy = totalProcessed > 0 ? (totalCorrect / totalProcessed) * 100 : 0;

    return {
      modelUsed: model || 'gemini-2.5-flash',
      threshold,
      totalProcessed,
      successfulCount,
      accuracy,
      confusionMatrix: {
        truePositives: tp,
        falsePositives: fp,
        trueNegatives: tn,
        falseNegatives: fn,
      },
      results,
    };
  }
}
