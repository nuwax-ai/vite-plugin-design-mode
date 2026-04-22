/**
 * postMessage bridge: optional request/response, validation hooks, heartbeats.
 */
export class EnhancedBridge {
    constructor(config = {}) {
        this.listeners = new Map();
        this.pendingRequests = new Map();
        this._isConnected = false;
        this.lastHeartbeat = 0;
        this.config = {
            timeout: 10000,
            retryAttempts: 3,
            retryDelay: 1000,
            heartbeatInterval: 30000,
            debug: false,
            ...config
        };
        this.initializeMessageHandling();
        this.initializeHeartbeat();
        this.initializeConnectionCheck();
    }
    /** Listen for `message` and mark connected after a short delay (iframe vs top). */
    initializeMessageHandling() {
        if (typeof window === 'undefined')
            return;
        window.addEventListener('message', this.handleMessage.bind(this));
        if (this.isIframeEnvironment()) {
            setTimeout(() => {
                this._isConnected = true;
                this.log('Bridge initialized and connected (iframe mode)');
                this.sendReadyMessage();
            }, 200);
        }
        else {
            setTimeout(() => {
                this._isConnected = true;
                this.log('Bridge initialized and connected (main window mode)');
            }, 100);
        }
    }
    /** Notify parent that the child iframe bridge is ready. */
    sendReadyMessage() {
        try {
            const readyMessage = {
                type: 'BRIDGE_READY',
                payload: {
                    timestamp: this.createTimestamp(),
                    environment: 'iframe'
                },
                timestamp: this.createTimestamp()
            };
            this.getTargetWindow().postMessage(readyMessage, '*');
            this.log('Sent ready message to parent');
        }
        catch (error) {
            this.log('Failed to send ready message:', error);
        }
    }
    /**
     * Periodic HEARTBEAT posts when running inside an iframe.
     */
    initializeHeartbeat() {
        if (typeof window === 'undefined')
            return;
        if (this.isIframeEnvironment()) {
            this.heartbeatTimer = setInterval(() => {
                this.sendHeartbeat();
            }, this.config.heartbeatInterval);
        }
    }
    /** Periodically infer disconnect from stale heartbeats. */
    initializeConnectionCheck() {
        if (typeof window === 'undefined')
            return;
        this.connectionCheckTimer = setInterval(() => {
            this.checkConnection();
        }, this.config.heartbeatInterval * 2);
    }
    /** True when `window.self !== window.top`. */
    isIframeEnvironment() {
        return typeof window !== 'undefined' && window.self !== window.top;
    }
    /** Snapshot for diagnostics / health. */
    getEnvironmentInfo() {
        if (typeof window === 'undefined') {
            return {
                isIframe: false,
                isConnected: false,
                origin: '',
                userAgent: '',
                location: ''
            };
        }
        return {
            isIframe: this.isIframeEnvironment(),
            isConnected: this._isConnected,
            origin: window.location.origin,
            userAgent: navigator.userAgent.substring(0, 100),
            location: window.location.href
        };
    }
    /** Log bridge state to the console (dev aid). */
    diagnose() {
        const env = this.getEnvironmentInfo();
        console.group('[EnhancedBridge] Bridge Diagnosis');
        console.log('Environment:', env);
        console.log('Connection Status:', this._isConnected);
        console.log('Pending Requests:', this.pendingRequests.size);
        console.log('Message Listeners:', Array.from(this.listeners.keys()));
        console.log('Config:', this.config);
        console.groupEnd();
    }
    /** Parent when iframe; `window` when top-level. */
    getTargetWindow() {
        return this.isIframeEnvironment() ? window.parent : window;
    }
    /** Route incoming postMessage payloads. */
    handleMessage(event) {
        // Optional origin filter (disabled by default):
        // if (event.origin !== window.location.origin && window.location.origin !== 'null') {
        //   if (!event.origin.startsWith('http') && !event.origin.startsWith('https')) {
        //     this.log('Received message from different origin, allowing:', event.origin);
        //   } else {
        //     this.log('Skipping message from different origin:', event.origin);
        //     return;
        //   }
        // }
        const message = event.data;
        // Drop malformed payloads
        if (!this.isValidMessage(message)) {
            this.log('Invalid message received:', message);
            return;
        }
        // Child handshake
        if (message.type === 'BRIDGE_READY') {
            this.log('Received ready message from child');
            this._isConnected = true;
            return;
        }
        // Completes a pending sendWithResponse
        if (this.isResponseMessage(message)) {
            this.handleResponseMessage(message);
            return;
        }
        // Fan-out to on(type) handlers
        this.dispatchMessage(message);
    }
    /** Resolve or reject pendingRequests entry. */
    handleResponseMessage(message) {
        const { requestId } = message;
        if (this.pendingRequests.has(requestId)) {
            const request = this.pendingRequests.get(requestId);
            clearTimeout(request.timeout);
            this.pendingRequests.delete(requestId);
            if (message.type === 'ACKNOWLEDGEMENT') {
                request.resolve({ success: true, acknowledged: true });
            }
            else {
                request.resolve(message);
            }
        }
    }
    /** Shape check before dispatch. */
    isValidMessage(message) {
        return (message &&
            typeof message.type === 'string' &&
            this.isSupportedMessageType(message.type));
    }
    /** Known DesignModeMessage union tags. */
    isSupportedMessageType(type) {
        const supportedTypes = [
            // Iframe to Parent
            'ELEMENT_SELECTED', 'ELEMENT_DESELECTED', 'CONTENT_UPDATED', 'STYLE_UPDATED',
            'DESIGN_MODE_CHANGED', 'ELEMENT_STATE_RESPONSE', 'ERROR', 'ACKNOWLEDGEMENT',
            'HEARTBEAT', 'HEALTH_CHECK_RESPONSE', 'BRIDGE_READY', 'ADD_TO_CHAT',
            // Parent to Iframe
            'TOGGLE_DESIGN_MODE', 'UPDATE_STYLE', 'UPDATE_CONTENT', 'BATCH_UPDATE',
            'HEALTH_CHECK'
        ];
        return supportedTypes.includes(type);
    }
    /** ACK or carries requestId. */
    isResponseMessage(message) {
        return message &&
            (message.type === 'ACKNOWLEDGEMENT' ||
                message.requestId !== undefined) &&
            (message.timestamp !== undefined);
    }
    /**
     * Fire-and-forget postMessage (may no-op if not connected).
     */
    async send(message) {
        if (!this._isConnected && this.isIframeEnvironment()) {
            this.log('Bridge not connected, attempting to reconnect...');
            await new Promise(resolve => setTimeout(resolve, 100));
            if (!this._isConnected) {
                console.warn('[EnhancedBridge] Bridge still not connected, message will be queued');
                return;
            }
        }
        if (!this._isConnected && !this.isIframeEnvironment()) {
            this.log('Running in main window, bridge connection not applicable');
            return;
        }
        const enhancedMessage = this.enhanceMessage(message);
        try {
            this.log('Sending message:', enhancedMessage);
            this.getTargetWindow().postMessage(enhancedMessage, '*');
            if (this.isIframeEnvironment() && enhancedMessage.requestId) {
                this.sendAcknowledgement(enhancedMessage.requestId);
            }
        }
        catch (error) {
            this.log('Error sending message:', error);
            // Dev: surface send failures
            if (process.env.NODE_ENV === 'development') {
                throw error;
            }
        }
    }
    /** RPC-style: wait until matching response or timeout. */
    async sendWithResponse(message, responseType) {
        if (!this._isConnected) {
            throw new Error('Bridge is not connected');
        }
        const enhancedMessage = this.enhanceMessage(message);
        const requestId = enhancedMessage.requestId;
        return new Promise((resolve, reject) => {
            // Timeout
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Request timeout after ${this.config.timeout}ms`));
            }, this.config.timeout);
            // Pending request map
            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeout,
                responseType
            });
            try {
                this.log('Sending request with response:', enhancedMessage);
                this.getTargetWindow().postMessage(enhancedMessage, '*');
            }
            catch (error) {
                this.pendingRequests.delete(requestId);
                clearTimeout(timeout);
                reject(error);
            }
        });
    }
    /** Ensure requestId + timestamp exist. */
    enhanceMessage(message) {
        const requestId = message.requestId || this.generateRequestId();
        const timestamp = message.timestamp || this.createTimestamp();
        return {
            ...message,
            requestId,
            timestamp
        };
    }
    /** Unique id for correlating responses. */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /** ms since epoch */
    createTimestamp() {
        return Date.now();
    }
    /** Best-effort ACK (messageType not wired through yet). */
    sendAcknowledgement(requestId) {
        const acknowledgement = {
            type: 'ACKNOWLEDGEMENT',
            payload: {
                messageType: 'UNKNOWN', // TODO: propagate originating type
            },
            requestId,
            timestamp: this.createTimestamp()
        };
        this.getTargetWindow().postMessage(acknowledgement, '*');
    }
    /** HEARTBEAT post to parent. */
    sendHeartbeat() {
        const heartbeat = {
            type: 'HEARTBEAT',
            payload: {
                timestamp: this.createTimestamp()
            },
            timestamp: this.createTimestamp()
        };
        this.getTargetWindow().postMessage(heartbeat, '*');
        this.lastHeartbeat = Date.now();
    }
    /** Mark disconnected if no heartbeats for 3× interval. */
    checkConnection() {
        const now = Date.now();
        const timeSinceLastHeartbeat = now - this.lastHeartbeat;
        if (timeSinceLastHeartbeat > this.config.heartbeatInterval * 3) {
            this.log('Connection appears to be lost');
            this._isConnected = false;
            // Optimistic reconnect
            setTimeout(() => {
                this._isConnected = true;
                this.log('Connection restored');
            }, 1000);
        }
    }
    /** Subscribe; returns unsubscribe. */
    on(type, handler) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type).add(handler);
        // Unsubscribe
        return () => {
            this.listeners.get(type)?.delete(handler);
        };
    }
    /** Remove one handler for `type`. */
    off(type, handler) {
        this.listeners.get(type)?.delete(handler);
    }
    /** Invoke all listeners for message.type */
    dispatchMessage(message) {
        const handlers = this.listeners.get(message.type);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(message);
                }
                catch (error) {
                    this.log('Error in message handler:', error);
                }
            });
        }
    }
    /** `_isConnected` flag */
    isConnected() {
        return this._isConnected;
    }
    /** Same as `isConnected` (legacy name). */
    isConnectedToTarget() {
        return this._isConnected;
    }
    /** Clear timers, reject pendings, remove listener. */
    disconnect() {
        this._isConnected = false;
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        if (this.connectionCheckTimer) {
            clearInterval(this.connectionCheckTimer);
        }
        // Reject pending RPCs
        this.pendingRequests.forEach(request => {
            clearTimeout(request.timeout);
            request.reject(new Error('Connection disconnected'));
        });
        this.pendingRequests.clear();
        // Remove global listener
        if (typeof window !== 'undefined') {
            window.removeEventListener('message', this.handleMessage.bind(this));
        }
        this.listeners.clear();
        this.log('Bridge disconnected');
    }
    /** Summarize connectivity; may issue HEALTH_CHECK RPC in iframe. */
    async healthCheck() {
        try {
            const env = this.getEnvironmentInfo();
            // Top-level window
            if (!env.isIframe && this._isConnected) {
                return {
                    status: 'healthy',
                    details: {
                        ...env,
                        message: 'Bridge is healthy and running in main window'
                    }
                };
            }
            if (env.isIframe && this._isConnected) {
                // Iframe: ping parent
                try {
                    const response = await this.sendWithResponse({
                        type: 'HEALTH_CHECK',
                        requestId: '',
                        timestamp: this.createTimestamp()
                    }, 'HEALTH_CHECK_RESPONSE');
                    return {
                        status: 'healthy',
                        details: {
                            ...env,
                            response: response.payload,
                            message: 'Bridge is healthy and responsive'
                        }
                    };
                }
                catch (error) {
                    return {
                        status: 'degraded',
                        details: {
                            ...env,
                            error: error instanceof Error ? error.message : 'Unknown error',
                            message: 'Bridge is connected but not responding to health checks'
                        }
                    };
                }
            }
            return {
                status: env.isIframe ? 'connecting' : 'unnecessary',
                details: {
                    ...env,
                    message: env.isIframe ? 'Bridge is initializing' : 'Bridge not needed in main window'
                }
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    environment: this.getEnvironmentInfo()
                }
            };
        }
    }
    /** Guarded by config.debug */
    log(...args) {
        if (this.config.debug) {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [EnhancedBridge]`, ...args);
        }
    }
    /** Alias for disconnect(). */
    destroy() {
        this.disconnect();
    }
}
/** Small helpers for request ids / timestamps. */
export const MessageUtils = {
    generateRequestId: () => {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },
    createTimestamp: () => {
        return Date.now();
    },
    isValidMessage: (message) => {
        return message &&
            typeof message.type === 'string' &&
            typeof message.timestamp === 'number';
    },
    createResponse: function (originalMessage, payload, success = true, error) {
        return {
            payload,
            type: payload?.type,
            requestId: originalMessage.requestId || '',
            timestamp: this.createTimestamp()
        };
    }
};
/** Singleton used by the design-mode client bundle. */
export const bridge = new EnhancedBridge();
/** Structural validation for a subset of message types. */
export class MessageValidatorImpl {
    validate(message) {
        const errors = [];
        if (!message) {
            errors.push('Message is null or undefined');
            return { isValid: false, errors };
        }
        if (typeof message.type !== 'string') {
            errors.push('Message type must be a string');
        }
        if (typeof message.timestamp !== 'number') {
            errors.push('Message timestamp must be a number');
        }
        // Per-type payload checks
        switch (message.type) {
            case 'ELEMENT_SELECTED':
                if (!message.payload?.elementInfo) {
                    errors.push('ELEMENT_SELECTED must have elementInfo in payload');
                }
                break;
            case 'UPDATE_STYLE':
            case 'UPDATE_CONTENT':
                if (!message.payload?.sourceInfo) {
                    errors.push(`${message.type} must have sourceInfo in payload`);
                }
                break;
            case 'BATCH_UPDATE':
                if (!Array.isArray(message.payload?.updates)) {
                    errors.push('BATCH_UPDATE must have updates array in payload');
                }
                break;
        }
        return {
            isValid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined
        };
    }
}
export const messageValidator = new MessageValidatorImpl();
//# sourceMappingURL=bridge.js.map