import { Component, inject, signal } from '@angular/core';
import { SettingsService } from './settings.service';

interface AnalysisResult {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  exif: any;
  c2pa: any;
  analysis?: {
    legitimacyScore: number;
    summary: string;
    analysisDetails: string;
    detectedAnomalies: string[];
  };
  error?: string;
}

@Component({
  selector: 'app-analyze',
  standalone: true,
  template: `
    <div class="analyze-container animated-fade-in">
      <div class="header-section">
        <h1 class="page-title">Digital Image Forensics</h1>
        <p class="page-subtitle">Upload an image to inspect cryptographic provenance (C2PA), camera EXIF headers, and perform AI-driven pixel analysis.</p>
      </div>

      <!-- Drag & Drop Zone -->
      @if (!selectedFile()) {
        <div 
          class="upload-zone"
          [class.dragover]="isDragOver()"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave()"
          (drop)="onDrop($event)"
        >
          <span class="material-icons-round upload-icon">cloud_upload</span>
          <h3>Drag and drop your image here</h3>
          <p class="upload-sub">Supports JPEG, PNG, WEBP (Max 20MB)</p>
          <button class="btn btn-secondary" style="margin-top: 16px;">Browse Files</button>
          <input type="file" accept="image/jpeg,image/png,image/webp" (change)="onFileSelected($event)" />
        </div>
      } @else {
        <!-- File Info & Control Area -->
        <div class="file-panel glass-panel">
          <div class="file-details">
            @if (previewUrl()) {
              <img [src]="previewUrl()" class="image-preview" alt="Preview" />
            }
            <div class="info-text">
              <h3>{{ selectedFile()?.name }}</h3>
              <p class="meta-tag">{{ selectedFile()?.type }} • {{ formatBytes(selectedFile()?.size || 0) }}</p>
            </div>
          </div>
          <div class="action-buttons">
            <button class="btn btn-secondary" [disabled]="loading()" (click)="clearFile()">Choose Another</button>
            <button class="btn btn-primary" [disabled]="loading()" (click)="analyze()">
              @if (loading()) {
                <span class="material-icons-round spinner">sync</span> Analyzing...
              } @else {
                <span class="material-icons-round">biotech</span> Run Forensic Audit
              }
            </button>
          </div>
        </div>
      }

      <!-- Loading State with Progress Steps -->
      @if (loading()) {
        <div class="loading-panel glass-panel">
          <h3 class="loader-title">Forensic Pipeline Executing</h3>
          <div class="progress-steps">
            <div class="step" [class.active]="currentStep() >= 1" [class.done]="currentStep() > 1">
              <span class="material-icons-round step-icon">
                {{ currentStep() > 1 ? 'check_circle' : 'pending' }}
              </span>
              <span>Reading Image Bytes</span>
            </div>
            <div class="step" [class.active]="currentStep() >= 2" [class.done]="currentStep() > 2">
              <span class="material-icons-round step-icon">
                {{ currentStep() > 2 ? 'check_circle' : 'pending' }}
              </span>
              <span>Extracting C2PA Provenance & EXIF</span>
            </div>
            <div class="step" [class.active]="currentStep() >= 3" [class.done]="currentStep() > 3">
              <span class="material-icons-round step-icon">
                {{ currentStep() > 3 ? 'check_circle' : 'pending' }}
              </span>
              <span>Analyzing Pixels via Gemini LLM</span>
            </div>
          </div>
        </div>
      }

      <!-- Result Section -->
      @if (result(); as res) {
        <div class="result-layout">
          <!-- Overview Cards -->
          <div class="overview-grid">
            <!-- Circular Guage Card -->
            <div class="score-card glass-panel" [class.score-legit]="getScoreCategory(res) === 'legit'" [class.score-suspicious]="getScoreCategory(res) === 'suspicious'" [class.score-danger]="getScoreCategory(res) === 'manipulated'">
              <h3>Legitimacy Score</h3>
              
              @if (res.error) {
                <div class="error-score">
                  <span class="material-icons-round" style="font-size: 3rem; color: var(--color-danger)">error</span>
                  <p>LLM Audit Failed</p>
                </div>
              } @else {
                <div class="gauge-wrapper">
                  <svg viewBox="0 0 100 100" class="gauge">
                    <circle cx="50" cy="50" r="42" class="gauge-bg" />
                    <circle cx="50" cy="50" r="42" class="gauge-value" 
                      [style.strokeDashoffset]="getStrokeOffset(res.analysis?.legitimacyScore || 0)" />
                  </svg>
                  <div class="gauge-text">
                    <span class="number">{{ res.analysis?.legitimacyScore }}%</span>
                    <span class="label">{{ getScoreLabel(res.analysis?.legitimacyScore || 0) }}</span>
                  </div>
                </div>
              }
            </div>

            <!-- Verdict & Summary -->
            <div class="verdict-card glass-panel">
              <h3>Executive Forensic Verdict</h3>
              @if (res.error) {
                <p class="error-msg">
                  <strong style="color: var(--color-danger)">Error:</strong> {{ res.error }}
                </p>
                <p class="fallback-note">EXIF and C2PA metadata were successfully parsed. See tabs below.</p>
              } @else {
                <p class="summary-text">{{ res.analysis?.summary }}</p>
                
                @if (res.analysis?.detectedAnomalies?.length) {
                  <h4 class="section-sub">Key Anomalies Detected</h4>
                  <ul class="anomalies-list">
                    @for (anomaly of res.analysis?.detectedAnomalies; track anomaly) {
                      <li>
                        <span class="material-icons-round list-flag">warning</span>
                        <span>{{ anomaly }}</span>
                      </li>
                    }
                  </ul>
                } @else {
                  <div class="clean-verdict">
                    <span class="material-icons-round check-icon">verified</span>
                    <span>No structural anomalies detected in visual artifacts.</span>
                  </div>
                }
              }
            </div>
          </div>

          <!-- Technical Details Tabbed Pane -->
          <div class="details-tabs glass-panel">
            <div class="tabs-header">
              <button class="tab-btn" [class.active]="activeTab() === 'report'" (click)="activeTab.set('report')">
                <span class="material-icons-round">description</span> Forensic Critique
              </button>
              <button class="tab-btn" [class.active]="activeTab() === 'c2pa'" (click)="activeTab.set('c2pa')">
                <span class="material-icons-round">history_edu</span> C2PA Manifest
              </button>
              <button class="tab-btn" [class.active]="activeTab() === 'exif'" (click)="activeTab.set('exif')">
                <span class="material-icons-round">settings_input_hdmi</span> EXIF Headers
              </button>
            </div>

            <div class="tab-content">
              <!-- Critique Report Tab -->
              @if (activeTab() === 'report') {
                <div class="critique-content">
                  @if (res.analysis?.analysisDetails) {
                    <div class="markdown-body" [innerHTML]="parseMarkdown(res.analysis?.analysisDetails || '')"></div>
                  } @else {
                    <p class="empty-state">No detailed review available. (LLM was not queried or encountered an error).</p>
                  }
                </div>
              }

              <!-- C2PA Tab -->
              @if (activeTab() === 'c2pa') {
                <div class="c2pa-content">
                  @if (res.c2pa?.hasC2pa) {
                    <div class="c2pa-header-tag">
                      <span class="badge badge-success">Cryptographically Authenticated</span>
                      <p class="c2pa-sub">Active Manifest Label: <strong>{{ res.c2pa?.activeManifest }}</strong></p>
                    </div>

                    @if (getActiveManifest(res); as manifest) {
                      <div class="info-grid">
                        <div class="info-card">
                          <label>Claim Generator</label>
                          <span>{{ manifest.claim_generator }}</span>
                        </div>
                        <div class="info-card">
                          <label>Signature Issuer</label>
                          <span>{{ manifest.signature_info?.issuer || 'Unknown Issuer' }}</span>
                        </div>
                        <div class="info-card">
                          <label>Signed Time</label>
                          <span>{{ formatManifestTime(manifest.signature_info?.time) }}</span>
                        </div>
                        <div class="info-card">
                          <label>Validation Status</label>
                          <span>
                            @if (res.c2pa?.validationStatus?.length === 0) {
                              <span style="color: var(--color-success)">Valid signature chain</span>
                            } @else {
                              <span style="color: var(--color-danger)">Validation flags present</span>
                            }
                          </span>
                        </div>
                      </div>

                      @if (manifest.assertions?.length) {
                        <h4 style="margin: 20px 0 10px 0;">Recorded Actions & Ingredients</h4>
                        <div class="actions-table-wrapper">
                          <table class="data-table">
                            <thead>
                              <tr>
                                <th>Assertion Label</th>
                                <th>Summary / Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (assertion of manifest.assertions; track assertion.label) {
                                <tr>
                                  <td><code>{{ assertion.label }}</code></td>
                                  <td>{{ getAssertionSummary(assertion) }}</td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                      }
                    }
                  } @else {
                    <div class="empty-provenance">
                      <span class="material-icons-round" style="font-size: 3rem; color: var(--text-muted);">no_accounts</span>
                      <h3>No C2PA Manifest Found</h3>
                      <p>This image contains no cryptographically signed metadata. It could be a standard camera photo or the metadata has been stripped.</p>
                    </div>
                  }
                </div>
              }

              <!-- EXIF Tab -->
              @if (activeTab() === 'exif') {
                <div class="exif-content">
                  @if (hasExifData(res.exif)) {
                    <div class="exif-search-row">
                      <input type="text" class="form-control" placeholder="Search EXIF headers..." [value]="exifSearchQuery()" (input)="onExifSearch($event)" />
                    </div>
                    <div class="actions-table-wrapper">
                      <table class="data-table">
                        <thead>
                          <tr>
                            <th>Header Tag</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (tag of getFilteredExifTags(res.exif); track tag.key) {
                            <tr>
                              <td class="tag-key">{{ tag.key }}</td>
                              <td class="tag-val">{{ tag.value }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <div class="empty-provenance">
                      <span class="material-icons-round" style="font-size: 3rem; color: var(--text-muted)">hdr_off</span>
                      <h3>No EXIF Metadata Found</h3>
                      <p>No EXIF headers were found in this image. The headers might have been cleared by a website or editing tool.</p>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .analyze-container {
      max-width: 1100px;
      margin: 40px auto;
      padding: 0 20px;
    }
    .header-section {
      text-align: center;
      margin-bottom: 40px;
    }
    .page-title {
      font-size: 2.2rem;
      background: linear-gradient(135deg, #ffffff, var(--color-primary-hover));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 10px;
    }
    .page-subtitle {
      color: var(--text-secondary);
      max-width: 650px;
      margin: 0 auto;
      font-size: 1rem;
    }
    .upload-sub {
      color: var(--text-muted);
      font-size: 0.85rem;
      margin-top: 4px;
    }
    .file-panel {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 20px;
    }
    .file-details {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .image-preview {
      width: 70px;
      height: 70px;
      object-fit: cover;
      border-radius: var(--border-radius-sm);
      border: 1px solid var(--border-color);
    }
    .info-text h3 {
      font-size: 1.1rem;
      margin-bottom: 2px;
      word-break: break-all;
    }
    .meta-tag {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
    .action-buttons {
      display: flex;
      gap: 12px;
    }
    .loading-panel {
      margin-top: 30px;
      text-align: center;
      animation: pulseBorder 2s infinite alternate;
    }
    .loader-title {
      font-size: 1.2rem;
      margin-bottom: 20px;
    }
    .progress-steps {
      display: flex;
      justify-content: center;
      gap: 40px;
      flex-wrap: wrap;
    }
    .step {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-muted);
      transition: color var(--transition-fast);
    }
    .step.active {
      color: var(--color-primary-hover);
    }
    .step.done {
      color: var(--color-success);
    }
    .step-icon {
      font-size: 1.3rem;
    }
    .spinner {
      animation: rotateSpinner 1.5s linear infinite;
    }
    .result-layout {
      margin-top: 40px;
      display: grid;
      grid-template-columns: 1fr;
      gap: 30px;
    }
    .overview-grid {
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 30px;
    }
    @media (max-width: 768px) {
      .overview-grid {
        grid-template-columns: 1fr;
      }
    }
    .score-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-height: 250px;
    }
    .score-card h3 {
      margin-bottom: 20px;
      font-size: 1.05rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
    }
    .gauge-wrapper {
      position: relative;
      width: 170px;
      height: 170px;
    }
    .gauge {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }
    .gauge-bg {
      fill: none;
      stroke: rgba(255, 255, 255, 0.04);
      stroke-width: 6;
    }
    .gauge-value {
      fill: none;
      stroke-width: 6;
      stroke-linecap: round;
      stroke-dasharray: 264;
      transition: stroke-dashoffset 1s ease-out;
    }
    .score-legit .gauge-value { stroke: var(--color-success); }
    .score-suspicious .gauge-value { stroke: var(--color-warning); }
    .score-danger .gauge-value { stroke: var(--color-danger); }
    
    .gauge-text {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .gauge-text .number {
      font-size: 2.1rem;
      font-weight: 800;
      font-family: var(--font-heading);
      line-height: 1;
    }
    .gauge-text .label {
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 600;
      margin-top: 4px;
      letter-spacing: 0.03em;
    }
    .score-legit .gauge-text .label { color: var(--color-success); }
    .score-suspicious .gauge-text .label { color: var(--color-warning); }
    .score-danger .gauge-text .label { color: var(--color-danger); }

    .error-score {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .verdict-card {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .verdict-card h3 {
      font-size: 1.05rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      margin-bottom: 12px;
    }
    .summary-text {
      font-size: 1.05rem;
      color: #ffffff;
      line-height: 1.5;
    }
    .section-sub {
      margin-top: 20px;
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 10px;
    }
    .anomalies-list {
      list-style: none;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 10px;
    }
    .anomalies-list li {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 0.9rem;
      color: #ffd8a8;
      background: rgba(245, 158, 11, 0.06);
      padding: 8px 12px;
      border-radius: var(--border-radius-sm);
      border: 1px solid rgba(245, 158, 11, 0.15);
    }
    .list-flag {
      font-size: 1.1rem;
      color: var(--color-warning);
      margin-top: 2px;
    }
    .clean-verdict {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--color-success);
      margin-top: 15px;
      font-size: 0.95rem;
      background: rgba(16, 185, 129, 0.05);
      border: 1px solid rgba(16, 185, 129, 0.15);
      padding: 10px 14px;
      border-radius: var(--border-radius-sm);
    }
    .check-icon {
      font-size: 1.3rem;
    }
    .details-tabs {
      padding: 0;
      overflow: hidden;
    }
    .tabs-header {
      display: flex;
      border-bottom: 1px solid var(--border-color);
      background: rgba(255, 255, 255, 0.01);
    }
    .tab-btn {
      flex: 1;
      padding: 16px;
      background: none;
      border: none;
      color: var(--text-secondary);
      font-family: var(--font-heading);
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all var(--transition-fast);
      border-bottom: 2px solid transparent;
    }
    .tab-btn:hover {
      color: var(--text-primary);
      background: rgba(255, 255, 255, 0.02);
    }
    .tab-btn.active {
      color: var(--color-primary-hover);
      border-bottom-color: var(--color-primary);
      background: rgba(139, 92, 246, 0.03);
    }
    .tab-content {
      padding: 24px;
    }
    .c2pa-header-tag {
      margin-bottom: 24px;
    }
    .c2pa-sub {
      margin-top: 8px;
      font-size: 0.9rem;
      color: var(--text-secondary);
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }
    .info-card {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--border-color);
      padding: 16px;
      border-radius: var(--border-radius-sm);
    }
    .info-card label {
      display: block;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      margin-bottom: 4px;
    }
    .info-card span {
      font-family: var(--font-heading);
      font-weight: 500;
      font-size: 1rem;
      word-break: break-all;
    }
    .actions-table-wrapper {
      margin-top: 15px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm);
      overflow-x: auto;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.9rem;
    }
    .data-table th, .data-table td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
    }
    .data-table th {
      background: rgba(255, 255, 255, 0.02);
      font-family: var(--font-heading);
      font-weight: 600;
      color: var(--text-secondary);
    }
    .data-table tbody tr:last-child td {
      border-bottom: none;
    }
    .tag-key {
      font-family: var(--font-mono);
      font-weight: 500;
      color: var(--color-secondary);
      width: 250px;
    }
    .tag-val {
      word-break: break-all;
    }
    .exif-search-row {
      margin-bottom: 15px;
    }
    .empty-provenance {
      text-align: center;
      padding: 40px 20px;
    }
    .empty-provenance h3 {
      font-size: 1.2rem;
      margin: 16px 0 8px 0;
    }
    .empty-provenance p {
      color: var(--text-secondary);
      max-width: 500px;
      margin: 0 auto;
      font-size: 0.9rem;
    }
  `,
})
export class AnalyzeComponent {
  protected readonly settingsService = inject(SettingsService);

  selectedFile = signal<File | null>(null);
  previewUrl = signal<string | null>(null);
  isDragOver = signal(false);
  
  loading = signal(false);
  currentStep = signal(1); // 1: Read, 2: C2PA/EXIF, 3: LLM
  
  result = signal<AnalysisResult | null>(null);
  activeTab = signal<'report' | 'c2pa' | 'exif'>('report');
  exifSearchQuery = signal('');

  onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.setFile(input.files[0]);
    }
  }

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave() {
    this.isDragOver.set(false);
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragOver.set(false);
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      this.setFile(e.dataTransfer.files[0]);
    }
  }

  setFile(file: File) {
    this.selectedFile.set(file);
    const reader = new FileReader();
    reader.onload = () => {
      this.previewUrl.set(reader.result as string);
    };
    reader.readAsDataURL(file);
    this.result.set(null);
  }

  clearFile() {
    this.selectedFile.set(null);
    this.previewUrl.set(null);
    this.result.set(null);
    this.loading.set(false);
    this.currentStep.set(1);
  }

  async analyze() {
    const file = this.selectedFile();
    if (!file) return;

    this.loading.set(true);
    this.currentStep.set(1);
    this.result.set(null);

    try {
      // Simulate step 1
      await this.sleep(400);
      this.currentStep.set(2);

      // Simulate step 2
      await this.sleep(600);
      this.currentStep.set(3);

      const headers: Record<string, string> = {};
      if (this.settingsService.apiKey()) {
        headers['x-gemini-api-key'] = this.settingsService.apiKey();
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', this.settingsService.model());
      formData.append('temperature', this.settingsService.temperature().toString());
      formData.append('customPrompt', this.settingsService.customPrompt());

      const response = await fetch('http://localhost:3000/api/analyze', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server returned error ${response.status}: ${errorText}`);
      }

      const data: AnalysisResult = await response.json();
      
      this.currentStep.set(4);
      await this.sleep(200);
      
      this.result.set(data);
      if (data.error || !data.analysis) {
        this.activeTab.set('exif');
      } else {
        this.activeTab.set('report');
      }
    } catch (err: any) {
      this.result.set({
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        exif: { error: 'Failed to complete analysis pipeline.' },
        c2pa: { hasC2pa: false, error: err.message },
        error: err.message || 'Unknown network error.',
      });
      this.activeTab.set('exif');
    } finally {
      this.loading.set(false);
    }
  }

  onExifSearch(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    this.exifSearchQuery.set(val);
  }

  getFilteredExifTags(exifObj: any): Array<{ key: string; value: string }> {
    if (!exifObj) return [];
    const keys = Object.keys(exifObj).filter((k) => k !== 'error');
    const query = this.exifSearchQuery().toLowerCase();
    
    const mapped = keys.map((key) => {
      let val = exifObj[key];
      if (val instanceof Uint8Array || typeof val === 'object') {
        try {
          val = JSON.stringify(val);
        } catch {
          val = val.toString();
        }
      }
      return { key, value: String(val) };
    });

    if (!query) return mapped;
    return mapped.filter((item) => 
      item.key.toLowerCase().includes(query) || item.value.toLowerCase().includes(query)
    );
  }

  hasExifData(exifObj: any): boolean {
    if (!exifObj) return false;
    if (exifObj.error) return false;
    return Object.keys(exifObj).length > 0;
  }

  getActiveManifest(res: AnalysisResult): any {
    const activeLabel = res.c2pa?.activeManifest;
    if (!activeLabel || !res.c2pa?.manifests) return null;
    return res.c2pa.manifests[activeLabel];
  }

  getAssertionSummary(assertion: any): string {
    if (!assertion) return '';
    if (assertion.data) {
      if (typeof assertion.data === 'object') {
        return JSON.stringify(assertion.data);
      }
      return String(assertion.data);
    }
    return 'Assertion payload exists';
  }

  formatManifestTime(timeString?: string): string {
    if (!timeString) return 'No timestamp verified';
    try {
      return new Date(timeString).toLocaleString();
    } catch {
      return timeString;
    }
  }

  getScoreCategory(res: AnalysisResult): 'legit' | 'suspicious' | 'manipulated' {
    if (res.error || !res.analysis) return 'manipulated';
    const score = res.analysis.legitimacyScore;
    if (score >= 75) return 'legit';
    if (score >= 45) return 'suspicious';
    return 'manipulated';
  }

  getScoreLabel(score: number): string {
    if (score >= 75) return 'Verified Legit';
    if (score >= 45) return 'Suspicious';
    return 'Manipulated';
  }

  getStrokeOffset(score: number): number {
    const maxOffset = 264; // circumference = 2 * PI * r (2 * 3.14159 * 42 = 263.89)
    return maxOffset - (score / 100) * maxOffset;
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  parseMarkdown(text: string): string {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Code blocks & inline code
    html = html.replace(/```([\s\S]*?)```/g, '<pre style="background: rgba(0,0,0,0.4); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color); font-family: var(--font-mono); font-size: 0.85rem; margin-bottom: 12px; overflow-x: auto; white-space: pre-wrap;">$1</pre>');
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');

    // Bullet items
    html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
    
    // Wrap lists roughly
    // Group adjacent li items in ul blocks
    html = html.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');

    // Split double line breaks into paragraphs
    html = html.split('\n\n').map((p) => {
      const trimmed = p.trim();
      if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<pre') || trimmed.startsWith('<li>')) {
        return trimmed;
      }
      return `<p style="margin-bottom: 12px;">${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    return html;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
