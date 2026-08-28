# Eazy Webhook

Monitor de Webhooks em tempo real com **Go (Backend)** e **Angular (Frontend)**.

Ao iniciar o backend, um túnel público HTTPS do Cloudflare e gerado automaticamente para você testar integrações com Chipeiras, gateways de pagamento, APIs e serviços externos.

---

## Como Executar

### 1. Iniciar o Backend (Go)

```bash
cd golang
go run .
```

> O backend rodara em `http://localhost:3000` e exibira no terminal a URL publica gerada (ex: `https://*.trycloudflare.com/api/webhook`).

---

### 2. Iniciar o Frontend (Angular)

Abra outro terminal e execute:

```bash
cd angular
npm install
npm start
```

Acesse no navegador: **`http://localhost:4200`**

---

## Como Testar

Com o backend e frontend rodando, envie uma requisicao de teste:

```bash
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"evento": "teste", "mensagem": "Webhook funcionando!"}'
```

O webhook aparecera instantaneamente na tela em tempo real.

---

## Estrutura das Pastas

- `golang/`: Servidor de alta performance em Go com WebSockets e Tunel Cloudflare.
- `angular/`: Interface visual em Angular com Tailwind CSS (Modo Claro/Escuro).
