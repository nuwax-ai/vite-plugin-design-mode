import { DesignModeMessage, MessageValidator, BridgeInterface, BridgeConfig, MessageUtilsInterface, MessageValidationResult } from './messages';
/**
 * postMessage bridge: optional request/response, validation hooks, heartbeats.
 */
export declare class EnhancedBridge implements BridgeInterface {
    private listeners;
    private pendingRequests;
    private config;
    private _isConnected;
    private lastHeartbeat;
    private heartbeatTimer?;
    private connectionCheckTimer?;
    constructor(config?: Partial<BridgeConfig>);
    /** Listen for `message` and mark connected after a short delay (iframe vs top). */
    private initializeMessageHandling;
    /** Notify parent that the child iframe bridge is ready. */
    private sendReadyMessage;
    /**
     * Periodic HEARTBEAT posts when running inside an iframe.
     */
    private initializeHeartbeat;
    /** Periodically infer disconnect from stale heartbeats. */
    private initializeConnectionCheck;
    /** True when `window.self !== window.top`. */
    private isIframeEnvironment;
    /** Snapshot for diagnostics / health. */
    getEnvironmentInfo(): {
        isIframe: boolean;
        isConnected: boolean;
        origin: string;
        userAgent: string;
        location: string;
    };
    /** Log bridge state to the console (dev aid). */
    diagnose(): void;
    /** Parent when iframe; `window` when top-level. */
    private getTargetWindow;
    /** Route incoming postMessage payloads. */
    private handleMessage;
    /** Resolve or reject pendingRequests entry. */
    private handleResponseMessage;
    /** Shape check before dispatch. */
    private isValidMessage;
    /** Known DesignModeMessage union tags. */
    private isSupportedMessageType;
    /** ACK or carries requestId. */
    private isResponseMessage;
    /**
     * Fire-and-forget postMessage (may no-op if not connected).
     */
    send<T extends DesignModeMessage>(message: T): Promise<void>;
    /** RPC-style: wait until matching response or timeout. */
    sendWithResponse<T extends DesignModeMessage, R extends DesignModeMessage>(message: T, responseType: R['type']): Promise<R>;
    /** Ensure requestId + timestamp exist. */
    private enhanceMessage;
    /** Unique id for correlating responses. */
    private generateRequestId;
    /** ms since epoch */
    private createTimestamp;
    /** Best-effort ACK (messageType not wired through yet). */
    private sendAcknowledgement;
    /** HEARTBEAT post to parent. */
    private sendHeartbeat;
    /** Mark disconnected if no heartbeats for 3× interval. */
    private checkConnection;
    /** Subscribe; returns unsubscribe. */
    on<T extends DesignModeMessage>(type: T['type'], handler: (message: T) => void): () => void;
    /** Remove one handler for `type`. */
    off(type: string, handler: Function): void;
    /** Invoke all listeners for message.type */
    private dispatchMessage;
    /** `_isConnected` flag */
    isConnected(): boolean;
    /** Same as `isConnected` (legacy name). */
    isConnectedToTarget(): boolean;
    /** Clear timers, reject pendings, remove listener. */
    disconnect(): void;
    /** Summarize connectivity; may issue HEALTH_CHECK RPC in iframe. */
    healthCheck(): Promise<{
        status: string;
        details: any;
    }>;
    /** Guarded by config.debug */
    private log;
    /** Alias for disconnect(). */
    destroy(): void;
}
/** Small helpers for request ids / timestamps. */
export declare const MessageUtils: MessageUtilsInterface;
/** Singleton used by the design-mode client bundle. */
export declare const bridge: EnhancedBridge;
/** Structural validation for a subset of message types. */
export declare class MessageValidatorImpl implements MessageValidator {
    validate(message: any): MessageValidationResult;
}
export declare const messageValidator: MessageValidatorImpl;
//# sourceMappingURL=bridge.d.ts.map