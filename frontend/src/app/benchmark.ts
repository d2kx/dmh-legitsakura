import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SettingsService } from './settings.service';

interface ConfusionMatrix {
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
}

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

interface BenchmarkData {
  modelUsed: string;
  threshold: number;
  totalProcessed: number;
  successfulCount: number;
  accuracy: number;
  confusionMatrix: ConfusionMatrix;
  results: BenchmarkResultItem[];
}

@Component({
  selector: 'app-benchmark',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div class="benchmark-container animated-fade-in">
      <div class="header-section">
        <h1 class="page-title">Forensic Accuracy Benchmarking</h1>
        <p class="page-subtitle">Evaluate the efficacy of Gemini Vision LLM and C2PA checks. Upload groups of known legitimate and manipulated images to compute classification metrics.</p>
      </div>

      <!-- File Inputs Row -->
      @if (!loading() && !benchmarkResult()) {
        <div class="upload-grid">
          <div class="upload-column">
            <div class="col-header">
              <span class="material-icons-round text-success">verified</span>
              <h3>1. Known Legit Images</h3>
            </div>
            <div 
              class="upload-zone drop-legit"
              [class.dragover]="isDragLegit()"
              (dragover)="onDragOver($event, 'legit')"
              (dragleave)="onDragLeave('legit')"
              (drop)="onDrop($event, 'legit')"
            >
              <span class="material-icons-round upload-icon text-success">folder_open</span>
              <p>Drag or select legit images</p>
              <span class="file-count">{{ legitFiles().length }} files staged</span>
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" (change)="onFilesSelected($event, 'legit')" />
            </div>
            @if (legitFiles().length) {
              <ul class="staged-list">
                @for (f of legitFiles(); track f.name; let idx = $index) {
                  <li>
                    <span class="filename">{{ f.name }}</span>
                    <span class="material-icons-round delete-btn" (click)="removeStaged('legit', idx)">close</span>
                  </li>
                }
              </ul>
            }
          </div>

          <div class="upload-column">
            <div class="col-header">
              <span class="material-icons-round text-danger">report_problem</span>
              <h3>2. Known Manipulated/AI Images</h3>
            </div>
            <div 
              class="upload-zone drop-manipulated"
              [class.dragover]="isDragManipulated()"
              (dragover)="onDragOver($event, 'manipulated')"
              (dragleave)="onDragLeave('manipulated')"
              (drop)="onDrop($event, 'manipulated')"
            >
              <span class="material-icons-round upload-icon text-danger">folder_special</span>
              <p>Drag or select manipulated images</p>
              <span class="file-count">{{ manipulatedFiles().length }} files staged</span>
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" (change)="onFilesSelected($event, 'manipulated')" />
            </div>
            @if (manipulatedFiles().length) {
              <ul class="staged-list">
                @for (f of manipulatedFiles(); track f.name; let idx = $index) {
                  <li>
                    <span class="filename">{{ f.name }}</span>
                    <span class="material-icons-round delete-btn" (click)="removeStaged('manipulated', idx)">close</span>
                  </li>
                }
              </ul>
            }
          </div>
        </div>
      }

      <!-- Settings & Run Options -->
      @if (!loading() && !benchmarkResult() && (legitFiles().length || manipulatedFiles().length)) {
        <div class="config-panel glass-panel">
          <div class="config-grid">
            <div class="form-group">
              <label>Decision Threshold: {{ threshold() }}%</label>
              <input type="range" min="10" max="90" step="5" class="form-control" [value]="threshold()" (input)="onThresholdInput($event)" />
              <small class="help-text">Images scoring equal or above this threshold are classified as Legit. Below is classified as Manipulated.</small>
            </div>
            <div class="form-group">
              <label>Gemini Model</label>
              <input type="text" class="form-control" readonly [value]="settingsService.model()" />
              <small class="help-text">Change in Settings tab if needed.</small>
            </div>
          </div>
          <div class="run-row">
            <button class="btn btn-secondary" (click)="resetBenchmark()">Clear Staged</button>
            <button class="btn btn-primary" (click)="startBenchmark()">
              <span class="material-icons-round">analytics</span> Execute Benchmark Run
            </button>
          </div>
        </div>
      }

      <!-- Progress Panel -->
      @if (loading()) {
        <div class="progress-panel glass-panel">
          <div class="loader-section">
            <span class="material-icons-round spinner loader-icon">sync</span>
            <h3>Analyzing Batch...</h3>
            <p>Processing image <strong>{{ currentProgressIndex() + 1 }}</strong> of <strong>{{ totalProgressCount() }}</strong></p>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" [style.width.%]="getProgressPercent()"></div>
          </div>
          <p class="current-file">Current File: <code>{{ currentProgressFile() }}</code></p>
        </div>
      }

      <!-- Results Dashboard -->
      @if (benchmarkResult(); as res) {
        <div class="results-dashboard animated-fade-in">
          <div class="run-meta-panel glass-panel">
            <div class="meta-cols">
              <div>
                <label>Model Audited</label>
                <strong>{{ res.modelUsed }}</strong>
              </div>
              <div>
                <label>Legitimacy Threshold</label>
                <strong>{{ res.threshold }}%</strong>
              </div>
              <div>
                <label>Successful Runs</label>
                <strong>{{ res.successfulCount }} / {{ res.totalProcessed }}</strong>
              </div>
              <div class="export-actions">
                <button class="btn btn-secondary btn-sm" (click)="exportJSON(res)">
                  <span class="material-icons-round">download</span> JSON
                </button>
                <button class="btn btn-secondary btn-sm" (click)="exportCSV(res)">
                  <span class="material-icons-round">download</span> CSV
                </button>
                <button class="btn btn-primary btn-sm" (click)="resetBenchmark()">
                  <span class="material-icons-round">refresh</span> Run New
                </button>
              </div>
            </div>
          </div>

          <div class="dashboard-grid">
            <!-- Accuracy Gauge Card -->
            <div class="gauge-card glass-panel">
              <h3>Overall Efficacy</h3>
              <div class="accuracy-circle">
                <svg viewBox="0 0 100 100" class="gauge">
                  <circle cx="50" cy="50" r="42" class="gauge-bg" />
                  <circle cx="50" cy="50" r="42" class="gauge-value" 
                    [style.strokeDashoffset]="getStrokeOffset(res.accuracy)" />
                </svg>
                <div class="gauge-text">
                  <span class="number">{{ res.accuracy | number:'1.0-1' }}%</span>
                  <span class="label">Total Accuracy</span>
                </div>
              </div>
            </div>

            <!-- Confusion Matrix Grid Card -->
            <div class="matrix-card glass-panel">
              <h3>Confusion Matrix (Manipulated = Positive Class)</h3>
              <div class="matrix-layout">
                <div class="matrix-axis y-axis">Actual Class</div>
                <div class="matrix-body">
                  <div class="matrix-header">
                    <div>Predicted Legit</div>
                    <div>Predicted Manipulated</div>
                  </div>
                  <div class="matrix-row">
                    <div class="row-label">Actual Legit</div>
                    <!-- True Negative -->
                    <div class="matrix-cell tn">
                      <span class="val">{{ res.confusionMatrix.trueNegatives }}</span>
                      <span class="lbl">True Negatives (TN)</span>
                    </div>
                    <!-- False Positive -->
                    <div class="matrix-cell fp">
                      <span class="val">{{ res.confusionMatrix.falsePositives }}</span>
                      <span class="lbl">False Positives (FP)</span>
                    </div>
                  </div>
                  <div class="matrix-row">
                    <div class="row-label">Actual Manipulated</div>
                    <!-- False Negative -->
                    <div class="matrix-cell fn">
                      <span class="val">{{ res.confusionMatrix.falseNegatives }}</span>
                      <span class="lbl">False Negatives (FN)</span>
                    </div>
                    <!-- True Positive -->
                    <div class="matrix-cell tp">
                      <span class="val">{{ res.confusionMatrix.truePositives }}</span>
                      <span class="lbl">True Positives (TP)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Individual Predictions Table -->
          <div class="table-card glass-panel">
            <h3>Individual File Logs</h3>
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Ground Truth</th>
                    <th>Prediction</th>
                    <th>Legit Score</th>
                    <th>Result</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of res.results; track item.filename) {
                    <tr [class.wrong-row]="!item.isCorrect" (click)="toggleRow(item.filename)">
                      <td><code class="file-code">{{ item.filename }}</code></td>
                      <td>
                        <span class="badge" [class.badge-success]="item.expected === 'legit'" [class.badge-danger]="item.expected === 'manipulated'">
                          {{ item.expected }}
                        </span>
                      </td>
                      <td>
                        <span class="badge" [class.badge-success]="item.predicted === 'legit'" [class.badge-danger]="item.predicted === 'manipulated'">
                          {{ item.predicted }}
                        </span>
                      </td>
                      <td class="score-col">
                        <strong [style.color]="getScoreColor(item.score)">{{ item.score }}%</strong>
                      </td>
                      <td>
                        @if (item.isCorrect) {
                          <span class="badge badge-success" style="padding: 2px 6px;">Correct</span>
                        } @else {
                          <span class="badge badge-danger" style="padding: 2px 6px;">Incorrect</span>
                        }
                      </td>
                      <td class="summary-col">
                        {{ item.summary }}
                      </td>
                    </tr>
                    @if (expandedRows().has(item.filename)) {
                      <tr class="details-row animated-fade-in">
                        <td colspan="6">
                          <div class="expanded-panel">
                            @if (item.error) {
                              <p style="color: var(--color-danger)"><strong>Error:</strong> {{ item.error }}</p>
                            } @else {
                              <h4>Discrepancies & Anomalies Noted:</h4>
                              @if (item.detectedAnomalies.length) {
                                <ul class="anomaly-bullets">
                                  @for (a of item.detectedAnomalies; track a) {
                                    <li>{{ a }}</li>
                                  }
                                </ul>
                              } @else {
                                <p style="color: var(--text-secondary)">No specific anomalies were flagged for this file.</p>
                              }
                            }
                          </div>
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .benchmark-container {
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
    .upload-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 30px;
    }
    @media (max-width: 768px) {
      .upload-grid {
        grid-template-columns: 1fr;
      }
    }
    .upload-column {
      display: flex;
      flex-direction: column;
    }
    .col-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .col-header h3 {
      font-size: 1.1rem;
    }
    .text-success { color: var(--color-success); }
    .text-danger { color: var(--color-danger); }
    
    .file-count {
      display: inline-block;
      margin-top: 8px;
      font-size: 0.8rem;
      background: rgba(255,255,255,0.06);
      padding: 2px 8px;
      border-radius: 20px;
      color: var(--text-secondary);
    }
    .staged-list {
      list-style: none;
      margin-top: 12px;
      max-height: 150px;
      overflow-y: auto;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm);
      padding: 6px;
      background: rgba(0,0,0,0.1);
    }
    .staged-list li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 8px;
      font-size: 0.8rem;
      border-bottom: 1px solid rgba(255,255,255,0.03);
    }
    .staged-list li:last-child {
      border-bottom: none;
    }
    .staged-list .filename {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding-right: 12px;
    }
    .delete-btn {
      cursor: pointer;
      color: var(--text-muted);
      font-size: 1rem;
    }
    .delete-btn:hover {
      color: var(--color-danger);
    }
    .config-panel {
      margin-bottom: 40px;
    }
    .config-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    @media (max-width: 576px) {
      .config-grid {
        grid-template-columns: 1fr;
      }
    }
    .run-row {
      display: flex;
      justify-content: space-between;
      margin-top: 20px;
      border-top: 1px solid var(--border-color);
      padding-top: 20px;
    }
    .progress-panel {
      text-align: center;
      padding: 30px;
      animation: pulseBorder 2s infinite alternate;
    }
    .loader-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .loader-icon {
      font-size: 3rem;
      color: var(--color-primary-hover);
    }
    .progress-bar-container {
      width: 100%;
      height: 8px;
      background: rgba(255,255,255,0.05);
      border-radius: 4px;
      margin: 20px 0;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
      border-radius: 4px;
      transition: width var(--transition-fast);
    }
    .current-file {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
    .results-dashboard {
      display: flex;
      flex-direction: column;
      gap: 30px;
    }
    .run-meta-panel {
      padding: 16px 24px;
    }
    .meta-cols {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .meta-cols label {
      display: block;
      font-size: 0.75rem;
      text-transform: uppercase;
      color: var(--text-secondary);
      letter-spacing: 0.05em;
    }
    .meta-cols strong {
      font-size: 1.05rem;
    }
    .export-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .btn-sm {
      padding: 6px 12px;
      font-size: 0.8rem;
    }
    .dashboard-grid {
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 30px;
    }
    @media (max-width: 800px) {
      .dashboard-grid {
        grid-template-columns: 1fr;
      }
    }
    .gauge-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 250px;
    }
    .gauge-card h3 {
      font-size: 1.05rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      margin-bottom: 20px;
    }
    .accuracy-circle {
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
      stroke: var(--color-primary);
      stroke-width: 6;
      stroke-linecap: round;
      stroke-dasharray: 264;
      transition: stroke-dashoffset 1s ease-out;
    }
    .gauge-text {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .gauge-text .number {
      font-size: 2.3rem;
      font-weight: 800;
      font-family: var(--font-heading);
      line-height: 1;
    }
    .gauge-text .label {
      font-size: 0.75rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      font-weight: 600;
      margin-top: 4px;
      letter-spacing: 0.03em;
    }
    .matrix-card h3 {
      font-size: 1.05rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      margin-bottom: 20px;
    }
    .matrix-layout {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .matrix-axis {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      transform: rotate(180deg);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      font-weight: 600;
    }
    .matrix-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .matrix-header {
      display: grid;
      grid-template-columns: 100px 1fr 1fr;
      text-align: center;
      font-size: 0.75rem;
      text-transform: uppercase;
      color: var(--text-secondary);
      font-weight: 600;
      padding-bottom: 4px;
    }
    .matrix-header div:first-child { visibility: hidden; }
    .matrix-row {
      display: grid;
      grid-template-columns: 100px 1fr 1fr;
      gap: 6px;
      height: 75px;
      align-items: center;
    }
    .row-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      color: var(--text-secondary);
      font-weight: 600;
      text-align: right;
      padding-right: 12px;
    }
    .matrix-cell {
      height: 100%;
      border-radius: var(--border-radius-sm);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      border: 1px solid var(--border-color);
      transition: all var(--transition-fast);
    }
    .matrix-cell:hover {
      transform: scale(1.02);
    }
    .matrix-cell.tn, .matrix-cell.tp {
      background: rgba(16, 185, 129, 0.08);
      border-color: rgba(16, 185, 129, 0.2);
    }
    .matrix-cell.fn, .matrix-cell.fp {
      background: rgba(239, 68, 68, 0.08);
      border-color: rgba(239, 68, 68, 0.2);
    }
    .matrix-cell .val {
      font-size: 1.5rem;
      font-weight: 700;
      font-family: var(--font-heading);
    }
    .matrix-cell.tn .val, .matrix-cell.tp .val { color: var(--color-success); }
    .matrix-cell.fn .val, .matrix-cell.fp .val { color: var(--color-danger); }
    
    .matrix-cell .lbl {
      font-size: 0.65rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      font-weight: 500;
    }
    .table-card {
      overflow: hidden;
      padding: 0;
    }
    .table-card h3 {
      font-size: 1.05rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-color);
    }
    .table-wrapper {
      overflow-x: auto;
    }
    .wrong-row td {
      background: rgba(239, 68, 68, 0.02);
    }
    .data-table tbody tr {
      cursor: pointer;
      transition: background var(--transition-fast);
    }
    .data-table tbody tr:hover td {
      background: var(--bg-surface-hover);
    }
    .file-code {
      font-size: 0.8rem;
    }
    .score-col {
      font-size: 0.95rem;
    }
    .summary-col {
      max-width: 320px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
    .details-row td {
      background: rgba(0,0,0,0.2) !important;
      padding: 16px 24px;
      border-bottom: 1px solid var(--border-color);
    }
    .expanded-panel h4 {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }
    .anomaly-bullets {
      margin-left: 20px;
      font-size: 0.85rem;
      color: #ffd8a8;
    }
    .anomaly-bullets li {
      margin-bottom: 4px;
    }
  `,
})
export class BenchmarkComponent {
  protected readonly settingsService = inject(SettingsService);

  legitFiles = signal<File[]>([]);
  manipulatedFiles = signal<File[]>([]);

  isDragLegit = signal(false);
  isDragManipulated = signal(false);

  threshold = signal(50);
  loading = signal(false);

  currentProgressIndex = signal(0);
  totalProgressCount = signal(0);
  currentProgressFile = signal('');

  benchmarkResult = signal<BenchmarkData | null>(null);
  expandedRows = signal<Set<string>>(new Set());

  onFilesSelected(e: Event, type: 'legit' | 'manipulated') {
    const input = e.target as HTMLInputElement;
    if (input.files) {
      const arr = Array.from(input.files);
      if (type === 'legit') {
        this.legitFiles.update((prev) => [...prev, ...arr]);
      } else {
        this.manipulatedFiles.update((prev) => [...prev, ...arr]);
      }
    }
  }

  onDragOver(e: DragEvent, type: 'legit' | 'manipulated') {
    e.preventDefault();
    if (type === 'legit') {
      this.isDragLegit.set(true);
    } else {
      this.isDragManipulated.set(true);
    }
  }

  onDragLeave(type: 'legit' | 'manipulated') {
    if (type === 'legit') {
      this.isDragLegit.set(false);
    } else {
      this.isDragManipulated.set(false);
    }
  }

  onDrop(e: DragEvent, type: 'legit' | 'manipulated') {
    e.preventDefault();
    this.onDragLeave(type);
    if (e.dataTransfer?.files) {
      const arr = Array.from(e.dataTransfer.files);
      if (type === 'legit') {
        this.legitFiles.update((prev) => [...prev, ...arr]);
      } else {
        this.manipulatedFiles.update((prev) => [...prev, ...arr]);
      }
    }
  }

  removeStaged(type: 'legit' | 'manipulated', index: number) {
    if (type === 'legit') {
      this.legitFiles.update((prev) => prev.filter((_, i) => i !== index));
    } else {
      this.manipulatedFiles.update((prev) => prev.filter((_, i) => i !== index));
    }
  }

  onThresholdInput(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    this.threshold.set(val);
  }

  resetBenchmark() {
    this.legitFiles.set([]);
    this.manipulatedFiles.set([]);
    this.benchmarkResult.set(null);
    this.expandedRows.set(new Set());
    this.loading.set(false);
  }

  async startBenchmark() {
    const legit = this.legitFiles();
    const manipulated = this.manipulatedFiles();

    if (legit.length === 0 && manipulated.length === 0) return;

    this.loading.set(true);
    this.expandedRows.set(new Set());
    this.benchmarkResult.set(null);

    const totalFiles = legit.length + manipulated.length;
    this.totalProgressCount.set(totalFiles);
    
    const results: BenchmarkResultItem[] = [];

    // Helper process to analyze single file
    const processFile = async (file: File, expected: 'legit' | 'manipulated') => {
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
        throw new Error(`Server error (${response.status})`);
      }

      const data = await response.json();
      if (data.error || !data.analysis) {
        throw new Error(data.error || 'Missing analysis body');
      }

      const score = data.analysis.legitimacyScore;
      const predicted = score >= this.threshold() ? 'legit' : 'manipulated';

      return {
        filename: file.name,
        expected,
        predicted,
        score,
        isCorrect: predicted === expected,
        summary: data.analysis.summary,
        detectedAnomalies: data.analysis.detectedAnomalies || [],
      } as BenchmarkResultItem;
    };

    // Run sequentially to keep progress and respect rate limits
    let counter = 0;

    for (const file of legit) {
      this.currentProgressIndex.set(counter);
      this.currentProgressFile.set(file.name);
      
      try {
        const item = await processFile(file, 'legit');
        results.push(item);
      } catch (err: any) {
        results.push({
          filename: file.name,
          expected: 'legit',
          predicted: 'manipulated',
          score: 0,
          isCorrect: false,
          summary: `Analysis failed: ${err.message}`,
          detectedAnomalies: [],
          error: err.message,
        });
      }
      counter++;
    }

    for (const file of manipulated) {
      this.currentProgressIndex.set(counter);
      this.currentProgressFile.set(file.name);

      try {
        const item = await processFile(file, 'manipulated');
        results.push(item);
      } catch (err: any) {
        results.push({
          filename: file.name,
          expected: 'manipulated',
          predicted: 'legit',
          score: 0,
          isCorrect: false,
          summary: `Analysis failed: ${err.message}`,
          detectedAnomalies: [],
          error: err.message,
        });
      }
      counter++;
    }

    // Compute stats
    let tp = 0, fp = 0, tn = 0, fn = 0;
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

    this.benchmarkResult.set({
      modelUsed: this.settingsService.model(),
      threshold: this.threshold(),
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
    });

    this.loading.set(false);
  }

  getProgressPercent(): number {
    if (this.totalProgressCount() === 0) return 0;
    return ((this.currentProgressIndex()) / this.totalProgressCount()) * 100;
  }

  getStrokeOffset(score: number): number {
    const maxOffset = 264;
    return maxOffset - (score / 100) * maxOffset;
  }

  getScoreColor(score: number): string {
    if (score >= 75) return 'var(--color-success)';
    if (score >= 45) return 'var(--color-warning)';
    return 'var(--color-danger)';
  }

  toggleRow(filename: string) {
    this.expandedRows.update((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      return next;
    });
  }

  exportJSON(res: BenchmarkData) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `legitsakura-benchmark-${res.modelUsed}-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  exportCSV(res: BenchmarkData) {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Filename,Ground Truth,Prediction,Legitimacy Score,Is Correct,Summary\n";
    
    res.results.forEach((item) => {
      const cleanSummary = item.summary.replace(/"/g, '""');
      csvContent += `"${item.filename}","${item.expected}","${item.predicted}",${item.score},${item.isCorrect},"${cleanSummary}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodedUri);
    downloadAnchor.setAttribute("download", `legitsakura-benchmark-${res.modelUsed}-${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }
}
