import { Component } from '@angular/core';
import { WebhookDashboardComponent } from './features/webhook-dashboard/webhook-dashboard.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [WebhookDashboardComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'eazy-webhook-frontend';
}
