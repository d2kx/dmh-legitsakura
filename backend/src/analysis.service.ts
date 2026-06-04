import { Injectable, Logger } from '@nestjs/common';
import { Reader } from '@contentauth/c2pa-node';
import * as exifr from 'exifr';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  async extractExif(buffer: Buffer): Promise<any> {
    try {
      const exifData = await exifr.parse(buffer, {
        xmp: true,
        icc: true,
        jfif: true,
        iptc: true,
        gps: true,
      });
      return exifData || null;
    } catch (error) {
      this.logger.warn(`Failed to parse EXIF data: ${error.message}`);
      return { error: `Failed to parse EXIF: ${error.message}` };
    }
  }

  async extractC2pa(buffer: Buffer, mimeType: string): Promise<any> {
    try {
      const reader = await Reader.fromAsset({ buffer, mimeType });
      if (!reader) {
        return { hasC2pa: false, manifest: null };
      }
      const manifestStore = reader.json();
      return {
        hasC2pa: true,
        activeManifest: manifestStore.active_manifest,
        manifests: manifestStore.manifests,
        validationStatus: manifestStore.validation_status || [],
      };
    } catch (error) {
      this.logger.warn(`Failed to read C2PA: ${error.message}`);
      return {
        hasC2pa: false,
        error: `Failed to read C2PA manifest: ${error.message}`,
      };
    }
  }
}

