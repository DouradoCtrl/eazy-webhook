export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export interface WebhookHeaders {
  [key: string]: string | string[] | undefined;
}

export interface WebhookQuery {
  [key: string]: string | string[] | undefined;
}

export interface WebhookPayload {
  id: string;
  method: HttpMethod | string;
  url: string;
  path: string;
  headers: WebhookHeaders;
  query: WebhookQuery;
  body: any;
  ip?: string;
  timestamp: string;
  sizeBytes?: number;
}

export type SocketConnectionState = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface SocketConnectionStatus {
  state: SocketConnectionState;
  connected: boolean;
  clientId?: string;
  publicUrl?: string | null;
  isTunnelReloading?: boolean;
  timestamp?: string;
  error?: string;
}
