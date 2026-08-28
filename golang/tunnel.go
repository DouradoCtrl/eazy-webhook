package main

import (
	"bufio"
	"context"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
)

// Tunnel gerencia o processo do Cloudflare Quick Tunnel
type Tunnel struct {
	sync.Mutex
	port      string
	publicURL string
	cancel    context.CancelFunc
	hub       *Hub
}

func newTunnel(port string, hub *Hub) *Tunnel {
	return &Tunnel{port: port, hub: hub}
}

// URL retorna a URL pública atual
func (t *Tunnel) URL() string {
	t.Lock()
	defer t.Unlock()
	return t.publicURL
}

// Start inicia o túnel Cloudflare em segundo plano
func (t *Tunnel) Start() {
	t.Stop()

	if os.Getenv("DISABLE_TUNNEL") == "true" {
		return
	}

	ctx, cancel := context.WithCancel(context.Background())
	t.Lock()
	t.cancel = cancel
	t.Unlock()

	bin := findCloudflared()
	log.Printf("[Cloudflare] Inicializando túnel para a porta %s...", t.port)

	cmd := exec.CommandContext(ctx, bin, "tunnel", "--url", "http://localhost:"+t.port)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return
	}
	cmd.Stderr = cmd.Stdout

	if err := cmd.Start(); err != nil {
		log.Printf("[Cloudflare] Erro ao iniciar cloudflared: %v", err)
		return
	}

	urlRegex := regexp.MustCompile(`https://[a-zA-Z0-9-]+\.trycloudflare\.com`)

	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			if match := urlRegex.FindString(line); match != "" {
				t.Lock()
				t.publicURL = match
				t.Unlock()

				log.Printf("[Cloudflare] URL Pública Ativa: %s/api/webhook", match)

				t.hub.Broadcast(map[string]any{
					"type":       "public_url_available",
					"publicUrl":  match,
					"webhookUrl": match + "/api/webhook",
				})
				break
			}
		}
		cmd.Wait()
	}()
}

// Stop finaliza o processo do túnel
func (t *Tunnel) Stop() {
	t.Lock()
	defer t.Unlock()
	if t.cancel != nil {
		t.cancel()
		t.cancel = nil
	}
	t.publicURL = ""
}

// Reload reinicia o túnel e notifica os clientes
func (t *Tunnel) Reload() {
	t.hub.Broadcast(map[string]any{"type": "tunnel_reloading", "status": "reloading"})
	t.Start()
}

// Procura o binário do cloudflared no sistema
func findCloudflared() string {
	tmpDir := filepath.Join(os.TempDir(), "node-untun")
	if entries, err := os.ReadDir(tmpDir); err == nil {
		for _, entry := range entries {
			if strings.HasPrefix(entry.Name(), "cloudflared") {
				return filepath.Join(tmpDir, entry.Name())
			}
		}
	}
	if path, err := exec.LookPath("cloudflared"); err == nil {
		return path
	}
	return "cloudflared"
}
