import { Routes } from '@angular/router';
import { WebhookDashboardComponent } from './features/webhook-dashboard/webhook-dashboard.component';

export const routes: Routes = [
  {
    path: '',
    component: WebhookDashboardComponent,
    title: 'Monitor de Webhooks em Tempo Real'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
