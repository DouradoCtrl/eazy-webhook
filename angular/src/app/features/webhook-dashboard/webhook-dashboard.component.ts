import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { WebhookSocketService } from '../../core/services/webhook-socket.service';
import { SocketConnectionStatus, WebhookPayload } from '../../core/models/webhook.model';

@Component({
  selector: 'app-webhook-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './webhook-dashboard.component.html',
  styleUrls: ['./webhook-dashboard.component.css']
})
export class WebhookDashboardComponent implements OnInit, OnDestroy {
  // Lista de webhooks em ordem cronológica decrescente (LIFO)
  public webhooks: WebhookPayload[] = [];
  
  // Status da conexão WebSocket e URL pública
  public connectionStatus: SocketConnectionStatus = {
    state: 'disconnected',
    connected: false,
    publicUrl: null,
    isTunnelReloading: false
  };

  // Estado do Tema (Dark Mode / Light Mode)
  public isDarkMode: boolean = true;

  // Contadores e filtros
  public totalReceived: number = 0;
  public filterMethod: string = 'ALL';
  public searchTerm: string = '';
  public expandedHeaders: { [webhookId: string]: boolean } = {};
  public copiedId: string | null = null;
  public copiedPublicUrl: boolean = false;
  public copiedCurl: boolean = false;

  private subscriptions = new Subscription();

  constructor(private readonly webhookSocketService: WebhookSocketService) {}

  ngOnInit(): void {
    // Inicializar tema a partir do localStorage ou preferência do sistema
    const savedTheme = localStorage.getItem('eazy_webhook_theme');
    if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
    } else {
      this.isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    this.applyTheme();

    // 1. Escutar alterações no status da conexão e URL pública do túnel
    this.subscriptions.add(
      this.webhookSocketService.connectionStatus$.subscribe({
        next: (status) => {
          this.connectionStatus = status;
        },
        error: (err) => console.error('[WebhookDashboard] Erro no status de conexão:', err)
      })
    );

    // 2. Escutar novos webhooks recebidos em tempo real (da chipeira)
    this.subscriptions.add(
      this.webhookSocketService.newWebhook$.subscribe({
        next: (webhook) => {
          this.webhooks = [webhook, ...this.webhooks];
          this.totalReceived++;
        },
        error: (err) => console.error('[WebhookDashboard] Erro ao receber webhook:', err)
      })
    );
  }

  /**
   * Alterna entre modo escuro (Dark) e modo claro (Light).
   */
  public toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('eazy_webhook_theme', this.isDarkMode ? 'dark' : 'light');
    this.applyTheme();
  }

  private applyTheme(): void {
    if (this.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  /**
   * Retorna a URL ativa para configurar na Chipeira.
   */
  public get activeWebhookUrl(): string {
    if (this.connectionStatus.publicUrl) {
      return `${this.connectionStatus.publicUrl}/api/webhook`;
    }
    return 'http://localhost:3000/api/webhook';
  }

  /**
   * Retorna o comando cURL de teste pronto para ser executado.
   */
  public get curlCommandExample(): string {
    return `curl -X POST ${this.activeWebhookUrl} \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "evento": "teste_webhook",\n    "origem": "api_externa",\n    "status": "sucesso",\n    "dados": {\n      "id": 12345,\n      "mensagem": "Webhook recebido com sucesso"\n    }\n  }'`;
  }

  /**
   * Copia a URL do Webhook ativa para a área de transferência.
   */
  public copyWebhookUrl(): void {
    navigator.clipboard.writeText(this.activeWebhookUrl).then(() => {
      this.copiedPublicUrl = true;
      setTimeout(() => {
        this.copiedPublicUrl = false;
      }, 2500);
    }).catch(err => console.error('Falha ao copiar URL:', err));
  }

  /**
   * Copia o comando cURL de exemplo para a área de transferência.
   */
  public copyCurlExample(): void {
    navigator.clipboard.writeText(this.curlCommandExample).then(() => {
      this.copiedCurl = true;
      setTimeout(() => {
        this.copiedCurl = false;
      }, 2500);
    }).catch(err => console.error('Falha ao copiar comando cURL:', err));
  }

  /**
   * Solicita o recarregamento do túnel Cloudflare para gerar uma nova URL pública.
   */
  public reloadTunnel(): void {
    this.webhookSocketService.reloadTunnel();
  }

  /**
   * Limpa a lista de webhooks na tela e zera o contador de eventos.
   */
  public clearWebhooks(): void {
    this.webhooks = [];
    this.totalReceived = 0;
    this.expandedHeaders = {};
  }

  /**
   * Alterna a expansão da visualização de headers de um card.
   */
  public toggleHeaders(id: string): void {
    this.expandedHeaders[id] = !this.expandedHeaders[id];
  }

  /**
   * Formata o payload JSON com indentação para exibição.
   */
  public formatJson(data: any): string {
    if (data === undefined || data === null) {
      return '{\n  /* Payload vazio */\n}';
    }
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return data;
      }
    }
    return JSON.stringify(data, null, 2);
  }

  /**
   * Copia o payload formatado para a área de transferência.
   */
  public copyToClipboard(webhook: WebhookPayload): void {
    const textToCopy = this.formatJson(webhook.body);
    navigator.clipboard.writeText(textToCopy).then(() => {
      this.copiedId = webhook.id;
      setTimeout(() => {
        if (this.copiedId === webhook.id) {
          this.copiedId = null;
        }
      }, 2000);
    }).catch(err => {
      console.error('Falha ao copiar payload:', err);
    });
  }

  /**
   * Retorna os webhooks filtrados.
   */
  public get filteredWebhooks(): WebhookPayload[] {
    return this.webhooks.filter(wh => {
      const matchesMethod = this.filterMethod === 'ALL' || wh.method.toUpperCase() === this.filterMethod;
      const term = this.searchTerm.trim().toLowerCase();
      const matchesSearch = !term || 
        wh.id.toLowerCase().includes(term) ||
        wh.path.toLowerCase().includes(term) ||
        JSON.stringify(wh.body).toLowerCase().includes(term);
      return matchesMethod && matchesSearch;
    });
  }

  /**
   * Retorna as classes do badge de método HTTP com base na cor.
   */
  public getMethodBadgeClass(method: string): string {
    switch (method.toUpperCase()) {
      case 'POST':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30';
      case 'GET':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
      case 'PUT':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30';
      case 'DELETE':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30';
      case 'PATCH':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30';
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/30';
    }
  }

  /**
   * Reconexão manual com o WebSocket.
   */
  public reconnect(): void {
    this.webhookSocketService.reconnect();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
