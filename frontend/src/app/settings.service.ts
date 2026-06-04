import { Injectable, signal, effect } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  readonly apiKey = signal<string>(localStorage.getItem('gemini_api_key') || '');
  readonly model = signal<string>(localStorage.getItem('gemini_model') || 'gemini-2.5-flash');
  readonly customPrompt = signal<string>(localStorage.getItem('gemini_custom_prompt') || '');
  readonly temperature = signal<number>(
    parseFloat(localStorage.getItem('gemini_temperature') || '0.2'),
  );

  constructor() {
    effect(() => {
      localStorage.setItem('gemini_api_key', this.apiKey());
    });
    effect(() => {
      localStorage.setItem('gemini_model', this.model());
    });
    effect(() => {
      localStorage.setItem('gemini_custom_prompt', this.customPrompt());
    });
    effect(() => {
      localStorage.setItem('gemini_temperature', this.temperature().toString());
    });
  }

  updateApiKey(val: string) {
    this.apiKey.set(val);
  }

  updateModel(val: string) {
    this.model.set(val);
  }

  updateCustomPrompt(val: string) {
    this.customPrompt.set(val);
  }

  updateTemperature(val: number) {
    this.temperature.set(val);
  }
}
