import {
  DesignModeMessage,
  IframeToParentMessage,
  ParentToIframeMessage,
  RequestResponseMessage,
  MessageValidator,
  BridgeInterface,
  BridgeConfig,
  MessageUtilsInterface,
  MessageValidationResult,
  AcknowledgementMessage,
  HealthCheckMessage,
  HealthCheckResponseMessage,
  HeartbeatMessage
} from './messages';

/**
 * postMessage bridge: optional request/response, validation hooks, heartbeats.
 */
export class EnhancedBridge implements BridgeInterface {
  private listeners: Map<string, Set<Function>> = new Map();
  private pendingRequests: Map<string, {
    resolve: Function;
    reject: Function;
    timeout: NodeJS.Timeout;
    responseType: string;
  }> = new Map();
  
  private config: BridgeConfig;
  private _isConnected = false;
  private lastHeartbeat = 0;
  private heartbeatTimer?: NodeJS.Timeout;
  private connectionCheckTimer?: NodeJS.Timeout;

  // TEMP: 生产环境调试日志（问题排查完成后请删除）
  private tempLog(message: string, data?: unknown) {
    console.log(`[DesignModeDebug][BRIDGE][TEMP] ${message}`, data);
  }

  constructor(config: Partial<BridgeConfig> = {}) {
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
  private initializeMessageHandling() {
    if (typeof window === 'undefined') return;

    window.addEventListener('message', this.handleMessage.bind(this));
    this.tempLog('initializeMessageHandling', {
      href: window.location.href,
      origin: window.location.origin,
      isIframe: this.isIframeEnvironment(),
    });

    if (this.isIframeEnvironment()) {
      setTimeout(() => {
        this._isConnected = true;
        this.log('Bridge initialized and connected (iframe mode)');

        this.sendReadyMessage();
      }, 200);
    } else {
      setTimeout(() => {
        this._isConnected = true;
        this.log('Bridge initialized and connected (main window mode)');
      }, 100);
    }
  }

  /** Notify parent that the child iframe bridge is ready. */
  private sendReadyMessage() {
    try {
      const readyMessage = {
        type: 'BRIDGE_READY',
        payload: {
          timestamp: this.createTimestamp(),
          environment: 'iframe'
        },
        timestamp: this.createTimestamp()
      };
      this.tempLog('send BRIDGE_READY', readyMessage);
      
      this.getTargetWindow().postMessage(readyMessage, '*');
      this.log('Sent ready message to parent');
    } catch (error) {
      this.log('Failed to send ready message:', error);
    }
  }

  /**
   * Periodic HEARTBEAT posts when running inside an iframe.
   */
  private initializeHeartbeat() {
    if (typeof window === 'undefined') return;

    if (this.isIframeEnvironment()) {
      this.heartbeatTimer = setInterval(() => {
        this.sendHeartbeat();
      }, this.config.heartbeatInterval);
    }
  }

  /** Periodically infer disconnect from stale heartbeats. */
  private initializeConnectionCheck() {
    if (typeof window === 'undefined') return;

    this.connectionCheckTimer = setInterval(() => {
      this.checkConnection();
    }, this.config.heartbeatInterval * 2);
  }

  /** True when `window.self !== window.top`. */
  private isIframeEnvironment(): boolean {
    return typeof window !== 'undefined' && window.self !== window.top;
  }

  /** Snapshot for diagnostics / health. */
  public getEnvironmentInfo(): {
    isIframe: boolean;
    isConnected: boolean;
    origin: string;
    userAgent: string;
    location: string;
  } {
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
  public diagnose(): void {
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
  private getTargetWindow(): Window {
    return this.isIframeEnvironment() ? window.parent : window;
  }

  /** Route incoming postMessage payloads. */
  private handleMessage(event: MessageEvent) {
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
    if (message?.type === 'TOGGLE_DESIGN_MODE') {
      this.tempLog('handleMessage received TOGGLE_DESIGN_MODE', {
        message,
        origin: event.origin,
        sourceIsParent:
          typeof window !== 'undefined' ? event.source === window.parent : false,
      });
    }
    
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

    // 父窗口 -> iframe 的控制类消息：必须优先走业务分发，不能误判为 RPC response。
    // 否则像 TOGGLE_DESIGN_MODE 这类同样带 requestId/timestamp 的消息会被 isResponseMessage
    // 吞掉，导致 bridge.on('TOGGLE_DESIGN_MODE') 永远不触发，父页面一直等不到 DESIGN_MODE_CHANGED。
    if (this.isIframeEnvironment() && this.isParentToIframeCommand(message)) {
      this.dispatchMessage(message);
      return;
    }

    // Completes a pending sendWithResponse（仅处理真正的响应类型，避免与父到子命令冲突）
    if (this.isResponseMessage(message)) {
      this.handleResponseMessage(message);
      return;
    }

    // Fan-out to on(type) handlers
    this.dispatchMessage(message);
  }

  /** Resolve or reject pendingRequests entry. */
  private handleResponseMessage(message: RequestResponseMessage) {
    const { requestId } = message;
    
    if (this.pendingRequests.has(requestId)) {
      const request = this.pendingRequests.get(requestId)!;
      clearTimeout(request.timeout);
      this.pendingRequests.delete(requestId);

      if (message.type === 'ACKNOWLEDGEMENT') {
        request.resolve({ success: true, acknowledged: true });
      } else {
        request.resolve(message);
      }
    }
  }

  /** Shape check before dispatch. */
  private isValidMessage(message: any): message is DesignModeMessage {
    return (
      message &&
      typeof message.type === 'string' &&
      this.isSupportedMessageType(message.type)
    );
  }

  /** Known DesignModeMessage union tags. */
  private isSupportedMessageType(type: string): boolean {
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

  /**
   * 是否为 sendWithResponse / ACK 通道的响应消息。
   * 注意：不能仅凭 requestId + timestamp 判断，否则父页面发来的 TOGGLE_DESIGN_MODE
   *（同样带 requestId）会被误判为 response，从而跳过 dispatchMessage。
   */
  private isResponseMessage(message: any): message is RequestResponseMessage {
    if (!message || typeof message.type !== 'string') {
      return false;
    }
    if (message.requestId === undefined || message.timestamp === undefined) {
      return false;
    }
    return (
      message.type === 'ACKNOWLEDGEMENT' ||
      message.type === 'HEALTH_CHECK_RESPONSE'
    );
  }

  /** 父窗口发往 iframe 的控制命令（在 iframe 内必须由业务 handler 处理） */
  private isParentToIframeCommand(message: DesignModeMessage): boolean {
    const t = (message as { type?: string }).type;
    return (
      t === 'TOGGLE_DESIGN_MODE' ||
      t === 'UPDATE_STYLE' ||
      t === 'UPDATE_CONTENT' ||
      t === 'BATCH_UPDATE' ||
      t === 'HEALTH_CHECK'
    );
  }

  /**
   * Fire-and-forget postMessage (may no-op if not connected).
   */
  public async send<T extends DesignModeMessage>(message: T): Promise<void> {
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
    if (
      enhancedMessage.type === 'DESIGN_MODE_CHANGED' ||
      enhancedMessage.type === 'TOGGLE_DESIGN_MODE' ||
      enhancedMessage.type === 'BRIDGE_READY'
    ) {
      this.tempLog('send message', {
        type: enhancedMessage.type,
        requestId: enhancedMessage.requestId,
        timestamp: enhancedMessage.timestamp,
        isConnected: this._isConnected,
        isIframe: this.isIframeEnvironment(),
      });
    }
    
    try {
      this.log('Sending message:', enhancedMessage);
      
      this.getTargetWindow().postMessage(enhancedMessage, '*');

      if (this.isIframeEnvironment() && enhancedMessage.requestId) {
        this.sendAcknowledgement(enhancedMessage.requestId);
      }
    } catch (error) {
      this.log('Error sending message:', error);
      
      // Dev: surface send failures
      if (process.env.NODE_ENV === 'development') {
        throw error;
      }
    }
  }

  /** RPC-style: wait until matching response or timeout. */
  public async sendWithResponse<T extends DesignModeMessage, R extends DesignModeMessage>(
    message: T,
    responseType: R['type']
  ): Promise<R> {
    if (!this._isConnected) {
      throw new Error('Bridge is not connected');
    }

    const enhancedMessage = this.enhanceMessage(message);
    const requestId = enhancedMessage.requestId!;

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
      } catch (error) {
        this.pendingRequests.delete(requestId);
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /** Ensure requestId + timestamp exist. */
  private enhanceMessage<T extends DesignModeMessage>(message: T): T & { requestId?: string; timestamp: number } {
    const requestId = (message as any).requestId || this.generateRequestId();
    const timestamp = (message as any).timestamp || this.createTimestamp();
    
    return {
      ...message,
      requestId,
      timestamp
    };
  }

  /** Unique id for correlating responses. */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /** ms since epoch */
  private createTimestamp(): number {
    return Date.now();
  }

  /** Best-effort ACK (messageType not wired through yet). */
  private sendAcknowledgement(requestId: string) {
    const acknowledgement: AcknowledgementMessage = {
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
  private sendHeartbeat() {
    const heartbeat: HeartbeatMessage = {
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
   private checkConnection() {
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
  public on<T extends DesignModeMessage>(type: T['type'], handler: (message: T) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    
    this.listeners.get(type)!.add(handler);
    
    // Unsubscribe
    return () => {
      this.listeners.get(type)?.delete(handler);
    };
  }

  /** Remove one handler for `type`. */
  public off(type: string, handler: Function): void {
    this.listeners.get(type)?.delete(handler);
  }

  /** Invoke all listeners for message.type */
  private dispatchMessage(message: DesignModeMessage) {
    const handlers = this.listeners.get(message.type);
    if (message.type === 'TOGGLE_DESIGN_MODE' || message.type === 'DESIGN_MODE_CHANGED') {
      this.tempLog('dispatchMessage', {
        type: message.type,
        requestId: (message as { requestId?: string }).requestId,
        handlersCount: handlers ? handlers.size : 0,
      });
    }
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          this.log('Error in message handler:', error);
        }
      });
    }
  }

  /** `_isConnected` flag */
  public isConnected(): boolean {
    return this._isConnected;
  }

  /** Same as `isConnected` (legacy name). */
  public isConnectedToTarget(): boolean {
    return this._isConnected;
  }

  /** Clear timers, reject pendings, remove listener. */
  public disconnect(): void {
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
  public async healthCheck(): Promise<{ status: string; details: any }> {
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
          const response = await this.sendWithResponse<HealthCheckMessage, HealthCheckResponseMessage>(
            {
              type: 'HEALTH_CHECK',
              requestId: '',
              timestamp: this.createTimestamp()
            },
            'HEALTH_CHECK_RESPONSE'
          );

          return {
            status: 'healthy',
            details: {
              ...env,
              response: response.payload,
              message: 'Bridge is healthy and responsive'
            }
          };
        } catch (error) {
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
    } catch (error) {
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
  private log(...args: any[]) {
    if (this.config.debug) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [EnhancedBridge]`, ...args);
    }
  }

  /** Alias for disconnect(). */
  public destroy(): void {
    this.disconnect();
  }
}

/** Small helpers for request ids / timestamps. */
export const MessageUtils: MessageUtilsInterface = {
  generateRequestId: (): string => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  createTimestamp: (): number => {
    return Date.now();
  },

  isValidMessage: (message: any): boolean => {
    return message && 
           typeof message.type === 'string' &&
           typeof message.timestamp === 'number';
  },

  createResponse: function<T extends IframeToParentMessage>(
    originalMessage: ParentToIframeMessage,
    payload: T extends { payload: infer P } ? P : never,
    success: boolean = true,
    error?: string
  ): T {
    return {
      payload,
      type: (payload as any)?.type,
      requestId: (originalMessage as any).requestId || '',
      timestamp: this.createTimestamp()
    } as unknown as T;
  }
};

/** Singleton used by the design-mode client bundle. */
export const bridge = new EnhancedBridge();

/** Structural validation for a subset of message types. */
export class MessageValidatorImpl implements MessageValidator {
  validate(message: any): MessageValidationResult {
    const errors: string[] = [];

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
