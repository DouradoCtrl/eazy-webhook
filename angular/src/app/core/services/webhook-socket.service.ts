import { Injectable, OnDestroy } from '@angular/core';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { SocketConnectionStatus, WebhookPayload } from '../models/webhook.model';

@Injectable({
  providedIn: 'root'
})
export class WebhookSocketService implements OnDestroy {
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;
  private isDestroyed = false;
  private readonly defaultWsUrl = 'ws://localhost:3000/ws';

  // BehaviorSubject para o status da conexão (estado atual sempre disponível)
  private readonly connectionStatusSubject = new BehaviorSubject<SocketConnectionStatus>({
    state: 'disconnected',
    connected: false,
    publicUrl: null,
    isTunnelReloading: false
  });

  // Subject para emitir cada novo webhook recebido em tempo real
  private readonly webhookSubject = new Subject<WebhookPayload>();

  /**
   * Observable público que emite atualizações no status da conexão com o WebSocket.
   */
  public readonly connectionStatus$: Observable<SocketConnectionStatus> = 
    this.connectionStatusSubject.asObservable();

  /**
   * Observable público que emite cada novo payload de webhook recebido.
   */
  public readonly newWebhook$: Observable<WebhookPayload> = 
    this.webhookSubject.asObservable();

  constructor() {
    this.initSocket();
  }

  /**
   * Inicializa a conexão com o servidor WebSocket nativo em Go.
   */
  public initSocket(wsUrl: string = this.defaultWsUrl): void {
    if (this.isDestroyed) return;

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.connectionStatusSubject.next({
      ...this.connectionStatusSubject.value,
      state: 'connecting',
      connected: false
    });

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WebhookSocketService] Conectado ao WebSocket Go:', wsUrl);
        this.connectionStatusSubject.next({
          ...this.connectionStatusSubject.value,
          state: 'connected',
          connected: true,
          timestamp: new Date().toISOString()
        });
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          this.handleSocketMessage(data);
        } catch (err) {
          console.error('[WebhookSocketService] Erro ao processar mensagem JSON:', err);
        }
      };

      this.ws.onclose = () => {
        if (this.isDestroyed) return;
        console.warn('[WebhookSocketService] Conexão WebSocket encerrada. Tentando reconectar...');
        this.connectionStatusSubject.next({
          ...this.connectionStatusSubject.value,
          state: 'disconnected',
          connected: false
        });
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WebhookSocketService] Erro no WebSocket:', error);
        this.connectionStatusSubject.next({
          ...this.connectionStatusSubject.value,
          state: 'error',
          connected: false
        });
      };

    } catch (error) {
      console.error('[WebhookSocketService] Falha ao inicializar WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Processa os eventos recebidos do servidor WebSocket em Go.
   */
  private handleSocketMessage(data: any): void {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'connection_established':
        this.connectionStatusSubject.next({
          state: 'connected',
          connected: true,
          clientId: data.clientId,
          publicUrl: data.publicUrl || this.connectionStatusSubject.value.publicUrl,
          isTunnelReloading: !!data.isTunnelReloading,
          timestamp: data.timestamp || new Date().toISOString()
        });
        break;

      case 'tunnel_reloading':
        console.log('[WebhookSocketService] Túnel Cloudflare reiniciando...');
        this.connectionStatusSubject.next({
          ...this.connectionStatusSubject.value,
          isTunnelReloading: true
        });
        break;

      case 'public_url_available':
        console.log('[WebhookSocketService] Nova URL pública do Cloudflare:', data.publicUrl);
        this.connectionStatusSubject.next({
          ...this.connectionStatusSubject.value,
          publicUrl: data.publicUrl,
          isTunnelReloading: false
        });
        break;

      case 'new_webhook_request':
        const payload: WebhookPayload = data.webhook || {
          id: data.id,
          method: data.method,
          url: data.url,
          path: data.path,
          headers: data.headers,
          query: data.query || {},
          body: data.body,
          ip: data.ip,
          timestamp: data.timestamp,
          sizeBytes: data.sizeBytes
        };
        console.log('[WebhookSocketService] Novo Webhook recebido:', payload);
        this.webhookSubject.next(payload);
        break;
    }
  }

  /**
   * Agenda reconexão automática com o WebSocket.
   */
  private scheduleReconnect(): void {
    if (this.isDestroyed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('[WebhookSocketService] Tentando reconectar ao WebSocket...');
      this.initSocket();
    }, 2500);
  }

  /**
   * Dispara solicitação para recarregar o túnel Cloudflare no backend.
   */
  public reloadTunnel(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.connectionStatusSubject.next({
        ...this.connectionStatusSubject.value,
        isTunnelReloading: true
      });
      this.ws.send(JSON.stringify({ action: 'reload_tunnel' }));
    }
  }

  /**
   * Força a reconexão manual com o servidor.
   */
  public reconnect(): void {
    this.initSocket();
  }

  /**
   * Desconecta explicitamente o socket.
   */
  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionStatusSubject.next({
      ...this.connectionStatusSubject.value,
      state: 'disconnected',
      connected: false
    });
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.disconnect();
    this.connectionStatusSubject.complete();
    this.webhookSubject.complete();
  }
}
