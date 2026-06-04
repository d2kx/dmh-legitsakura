import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AnalysisService } from './analysis.service';
import { GeminiService } from './gemini.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, AnalysisService, GeminiService],
})
export class AppModule {}

