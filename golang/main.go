package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	hub := newHub()
	tunnel := newTunnel(port, hub)

	// 1. Conexão WebSocket para o Frontend Angular
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		hub.Add(conn)
		defer hub.Remove(conn)

		// Envia status inicial de conexão e URL do túnel
		conn.WriteJSON(map[string]any{
			"type":      "connection_established",
			"status":    "connected",
			"publicUrl": tunnel.URL(),
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})

		// Escuta comandos enviados pelo Angular (ex: recarregar túnel)
		for {
			var msg map[string]string
			if err := conn.ReadJSON(&msg); err != nil {
				break
			}
			if msg["action"] == "reload_tunnel" {
				go tunnel.Reload()
			}
		}
	})

	// 2. Rota Única de Webhook
	http.HandleFunc("/api/webhook", func(w http.ResponseWriter, r *http.Request) {
		enableCORS(w)
		if r.Method == http.MethodOptions {
			return
		}

		bodyBytes, _ := io.ReadAll(r.Body)

		// Tenta converter para JSON estruturado, senão mantém texto bruto
		var parsedBody any
		if json.Unmarshal(bodyBytes, &parsedBody) != nil {
			parsedBody = string(bodyBytes)
		}

		headers := make(map[string]string)
		for k, v := range r.Header {
			headers[strings.ToLower(k)] = strings.Join(v, ", ")
		}

		wh := Webhook{
			Type:      "new_webhook_request",
			ID:        fmt.Sprintf("wh_%d", time.Now().UnixMilli()),
			Method:    r.Method,
			URL:       r.RequestURI,
			Path:      r.URL.Path,
			Headers:   headers,
			Body:      parsedBody,
			IP:        r.RemoteAddr,
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			SizeBytes: len(bodyBytes),
		}

		log.Printf("[Webhook] [%s] %s - ID: %s", wh.Method, wh.Path, wh.ID)
		
		// Envia para o Angular em tempo real
		hub.Broadcast(wh)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]any{
			"success":   true,
			"message":   "Webhook recebido com sucesso",
			"id":        wh.ID,
			"timestamp": wh.Timestamp,
		})
	})

	log.Println("====================================================")
	log.Printf("[Go Server] Servidor rodando na porta %s", port)
	log.Printf("[Go Server] Endpoint Local: http://localhost:%s/api/webhook", port)
	log.Printf("[Go Server] Endpoint WebSocket: ws://localhost:%s/ws", port)
	log.Println("====================================================")

	// Inicia túnel em segundo plano
	go tunnel.Start()

	// Inicia o servidor HTTP
	log.Fatal(http.ListenAndServe("0.0.0.0:"+port, nil))
}

// Middleware de CORS para permitir requisições de qualquer origem
func enableCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "*")
}
