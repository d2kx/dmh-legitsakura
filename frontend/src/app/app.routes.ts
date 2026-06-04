import { Routes } from '@angular/router';
import { AnalyzeComponent } from './analyze';
import { BenchmarkComponent } from './benchmark';
import { SettingsComponent } from './settings';

export const routes: Routes = [
  { path: '', redirectTo: 'analyze', pathMatch: 'full' },
  { path: 'analyze', component: AnalyzeComponent },
  { path: 'benchmark', component: BenchmarkComponent },
  { path: 'settings', component: SettingsComponent },
  { path: '**', redirectTo: 'analyze' }
];

