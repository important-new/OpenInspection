// Design System 0520 subsystem B phase 2 task 2.6 — browser PresenceClient.
//
// Thin EventTarget wrapper around a WebSocket connection to
// /api/inspections/:id/presence/ws. Reconnects with exponential backoff,
// sends heartbeat every 30s, exposes `roster` events for consumers
// (TeamBanner, RosterPopover in phase 6 + 7).
//
// Usage:
//   const client = new PresenceClient({
//     wsUrl:    `${origin.replace(/^http/, 'ws')}/api/inspections/${id}/presence/ws`,
//     userId, name, photoUrl,
//   });
//   client.addEventListener('roster', e => render(e.detail));
//   client.connect();
//   client.setFocus(itemId);   // when user picks a new item
//   client.close();            // on page unload

import { encodeMessage, decodeMessage } from '/js/presence-protocol.js';

const HEARTBEAT_MS = 30_000;
const MAX_BACKOFF  = 30_000;

export class PresenceClient extends EventTarget {
    constructor({ wsUrl, userId, name, photoUrl }) {
        super();
        this.wsUrl = wsUrl;
        this.userId = userId;
        this.name = name;
        this.photoUrl = photoUrl ?? null;
        this.ws = null;
        this.backoff = 1000;
        this.heartbeatTimer = null;
        this.closed = false;
    }

    connect() {
        if (this.closed) return;
        try {
            this.ws = new WebSocket(this.wsUrl);
        } catch (err) {
            // URL malformed or network blocked — schedule a reconnect.
            this._scheduleReconnect();
            return;
        }

        this.ws.addEventListener('open', () => {
            this.backoff = 1000;
            this.send({ type: 'hello', userId: this.userId, name: this.name, photoUrl: this.photoUrl });
            this.heartbeatTimer = setInterval(() => this.send({ type: 'heartbeat' }), HEARTBEAT_MS);
            this.dispatchEvent(new CustomEvent('open'));
        });

        this.ws.addEventListener('message', (ev) => {
            const m = decodeMessage(ev.data);
            if (!m) return;
            this.dispatchEvent(new CustomEvent('message', { detail: m }));
            if (m.type === 'roster') {
                this.dispatchEvent(new CustomEvent('roster', { detail: m.users }));
            } else if (m.type === 'error') {
                this.dispatchEvent(new CustomEvent('protocol-error', { detail: m }));
            }
        });

        this.ws.addEventListener('close', () => {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
            this.dispatchEvent(new CustomEvent('close'));
            this._scheduleReconnect();
        });

        this.ws.addEventListener('error', () => {
            try { this.ws?.close(); } catch { /* already closing */ }
        });
    }

    send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(encodeMessage(msg));
        }
    }

    setFocus(itemId) {
        this.send({ type: 'focus', itemId: itemId ?? null });
    }

    close() {
        this.closed = true;
        try { this.send({ type: 'bye' }); } catch { /* swallow */ }
        try { this.ws?.close(); } catch { /* already closing */ }
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
    }

    _scheduleReconnect() {
        if (this.closed) return;
        setTimeout(() => this.connect(), this.backoff);
        this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF);
    }
}

// Eagerly expose globally so Alpine factories can construct one without an
// import statement (which would require a module-typed script tag at every
// callsite — see feedback_alpine_register_timing for why we keep these
// helpers on `window`).
window.PresenceClient = PresenceClient;
