import { Component, inject } from '@angular/core';
import { SettingsService } from './settings.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  template: `
    <div class="settings-container animated-fade-in">
      <div class="glass-panel">
        <h2 class="settings-title">Configure Analysis Environment</h2>
        <p class="settings-desc">
          Set up your Google Gemini credentials and model configuration. All changes are stored locally in your browser.
        </p>

        <!-- API Key Input -->
        <div class="form-group">
          <div class="label-row">
            <label for="apiKey">Gemini API Key</label>
            @if (settingsService.apiKey()) {
              <span class="badge badge-success">Configured</span>
            } @else {
              <span class="badge badge-warning">Missing Key (falls back to Env Var)</span>
            }
          </div>
          <input
            id="apiKey"
            type="password"
            class="form-control"
            placeholder="AIzaSy..."
            [value]="settingsService.apiKey()"
            (input)="onApiKeyInput($event)"
          />
          <small class="help-text">
            Obtain a key from <a href="https://aistudio.google.com/" target="_blank">Google AI Studio</a>.
          </small>
        </div>

        <!-- Model Selection -->
        <div class="form-group">
          <label for="model">Gemini Model</label>
          <select id="model" class="form-control" [value]="settingsService.model()" (change)="onModelSelect($event)">
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended - Fast & Cost-effective)</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro (High Accuracy - Complex Forensics)</option>
            <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite (Lightweight)</option>
            <option value="gemini-3.5-flash">Gemini 3.5 Flash (Latest Experimental)</option>
            <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Latest Lightweight Experimental)</option>
          </select>
        </div>

        <!-- Temperature Slider -->
        <div class="form-group">
          <div class="label-row">
            <label for="temperature">LLM Temperature: {{ settingsService.temperature() }}</label>
          </div>
          <input
            id="temperature"
            type="range"
            min="0"
            max="1"
            step="0.05"
            class="form-control range-slider"
            [value]="settingsService.temperature()"
            (input)="onTemperatureInput($event)"
          />
          <small class="help-text">
            Lower values (0.0 - 0.3) provide highly consistent, factual, and analytical results.
          </small>
        </div>

        <!-- Custom Prompt Template -->
        <div class="form-group">
          <label for="customPrompt">Custom System Prompt (Optional)</label>
          <textarea
            id="customPrompt"
            class="form-control text-area"
            rows="5"
            placeholder="Overwrite default system prompt guidelines here..."
            [value]="settingsService.customPrompt()"
            (input)="onPromptInput($event)"
          ></textarea>
          <small class="help-text">
            Leave empty to use the default specialized digital forensics prompt.
          </small>
        </div>

        <div class="actions-row">
          <button class="btn btn-secondary" (click)="clearAll()">Reset Defaults</button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .settings-container {
      max-width: 720px;
      margin: 40px auto;
      padding: 0 16px;
    }
    .settings-title {
      font-size: 1.8rem;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #ffffff, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .settings-desc {
      color: var(--text-secondary);
      font-size: 0.95rem;
      margin-bottom: 30px;
    }
    .label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2px;
    }
    .help-text {
      display: block;
      margin-top: 6px;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .range-slider {
      padding: 4px 0;
      cursor: pointer;
    }
    .text-area {
      resize: vertical;
      font-family: var(--font-body);
    }
    .actions-row {
      margin-top: 30px;
      border-top: 1px solid var(--border-color);
      padding-top: 20px;
      display: flex;
      justify-content: flex-end;
    }
  `,
})
export class SettingsComponent {
  protected readonly settingsService = inject(SettingsService);

  onApiKeyInput(e: Event) {
    const val = (e.target as HTMLInputElement).value.trim();
    this.settingsService.updateApiKey(val);
  }

  onModelSelect(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    this.settingsService.updateModel(val);
  }

  onTemperatureInput(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    this.settingsService.updateTemperature(val);
  }

  onPromptInput(e: Event) {
    const val = (e.target as HTMLTextAreaElement).value;
    this.settingsService.updateCustomPrompt(val);
  }

  clearAll() {
    this.settingsService.updateApiKey('');
    this.settingsService.updateModel('gemini-2.5-flash');
    this.settingsService.updateTemperature(0.2);
    this.settingsService.updateCustomPrompt('');
  }
}
