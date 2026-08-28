package main

import (
	"encoding/json"
	"sync"

	"github.com/gorilla/websocket"
)

// Hub gerencia os clientes conectados via WebSocket
type Hub struct {
	sync.Mutex
	clients map[*websocket.Conn]bool
}

func newHub() *Hub {
	return &Hub{
		clients: make(map[*websocket.Conn]bool),
	}
}

// Add registra uma nova conexão WebSocket
func (h *Hub) Add(conn *websocket.Conn) {
	h.Lock()
	defer h.Unlock()
	h.clients[conn] = true
}

// Remove remove uma conexão WebSocket
func (h *Hub) Remove(conn *websocket.Conn) {
	h.Lock()
	defer h.Unlock()
	delete(h.clients, conn)
	conn.Close()
}

// Broadcast envia uma mensagem JSON para todos os navegadores conectados
func (h *Hub) Broadcast(msg any) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	h.Lock()
	defer h.Unlock()
	for conn := range h.clients {
		conn.WriteMessage(websocket.TextMessage, data)
	}
}
