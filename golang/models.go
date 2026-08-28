package main

// Webhook representa os dados de uma requisição recebida e enviada ao frontend
type Webhook struct {
	Type      string            `json:"type"` // "new_webhook_request"
	ID        string            `json:"id"`
	Method    string            `json:"method"`
	URL       string            `json:"url"`
	Path      string            `json:"path"`
	Headers   map[string]string `json:"headers"`
	Body      interface{}       `json:"body"`
	IP        string            `json:"ip"`
	Timestamp string            `json:"timestamp"`
	SizeBytes int               `json:"sizeBytes"`
}
