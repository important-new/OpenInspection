// Design System 0520 subsystem B phase 2 task 2.7 — TenantPresenceClient.
//
// Sibling of PresenceClient (presence-client.js) but listens for
// `tenant-roster` messages instead of per-inspection `roster`. Used by
// the dashboard TeamStrip (phase 7) to show a tenant-wide aggregated
// presence map without N parallel inspection-level WS connections.

import { encodeMessage, decodeMessage } from '/js/presence-protocol.js';

const HEARTBEAT_MS = 30_000;
const MAX_BACKOFF  = 30_000;

export class TenantPresenceClient extends EventTarget {
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
            if (m.type === 'tenant-roster') {
                this.dispatchEvent(new CustomEvent('roster', { detail: m.members }));
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

    close() {
        this.closed = true;
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

window.TenantPresenceClient = TenantPresenceClient;
