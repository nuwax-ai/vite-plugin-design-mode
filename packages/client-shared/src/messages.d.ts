export interface SourceInfo {
    fileName: string;
    lineNumber: number;
    columnNumber: number;
    elementType?: string;
    componentName?: string;
    functionName?: string;
    elementId?: string;
    importPath?: string;
    isUIComponent?: boolean;
}
export interface ElementInfo {
    tagName: string;
    className: string;
    textContent: string;
    sourceInfo: SourceInfo;
    isStaticText: boolean;
    isStaticClass?: boolean;
    componentName?: string;
    componentPath?: string;
    props?: Record<string, string>;
    hierarchy?: {
        tagName: string;
        componentName?: string;
        fileName?: string;
    }[];
}
export interface MessageValidationResult {
    isValid: boolean;
    errors?: string[];
}
export interface MessageValidator {
    validate: (message: any) => MessageValidationResult;
}
export interface BridgeReadyMessage {
    type: 'BRIDGE_READY';
    payload: {
        timestamp: number;
        environment: 'iframe' | 'main';
    };
    timestamp?: number;
    requestId?: string;
}
export interface ElementSelectedMessage {
    type: 'ELEMENT_SELECTED';
    payload: {
        elementInfo: ElementInfo;
    };
    requestId?: string;
    timestamp?: number;
}
export interface ElementDeselectedMessage {
    type: 'ELEMENT_DESELECTED';
    requestId?: string;
    timestamp?: number;
    payload?: null;
}
export interface ContentUpdatedMessage {
    type: 'CONTENT_UPDATED';
    payload: {
        sourceInfo: SourceInfo;
        oldValue: string;
        newValue: string;
        realtime?: boolean;
    };
    requestId?: string;
    timestamp?: number;
}
export interface ContentUpdatedCallbackMessage {
    type: 'CONTENT_UPDATED_CALLBACK';
    payload: {
        sourceInfo: SourceInfo;
        oldValue: string;
        newValue: string;
        realtime?: boolean;
    };
    requestId?: string;
    timestamp?: number;
}
export interface StyleUpdatedMessage {
    type: 'STYLE_UPDATED';
    payload: {
        sourceInfo: SourceInfo;
        oldClass: string;
        newClass: string;
    };
    requestId?: string;
    timestamp?: number;
}
export interface DesignModeChangedMessage {
    type: 'DESIGN_MODE_CHANGED';
    enabled: boolean;
    requestId?: string;
    timestamp?: number;
}
export interface ToggleDesignModeMessage {
    type: 'TOGGLE_DESIGN_MODE';
    enabled: boolean;
    requestId?: string;
    timestamp?: number;
}
export interface UpdateStyleMessage {
    type: 'UPDATE_STYLE';
    payload: {
        sourceInfo: SourceInfo;
        newClass: string;
        persist?: boolean;
    };
    requestId?: string;
    timestamp?: number;
    enabled?: boolean;
}
export interface UpdateContentMessage {
    type: 'UPDATE_CONTENT';
    payload: {
        sourceInfo: SourceInfo;
        newContent: string;
        persist?: boolean;
    };
    requestId?: string;
    timestamp?: number;
}
export interface BatchUpdateItem {
    type: 'style' | 'content';
    sourceInfo: SourceInfo;
    newValue: string;
    originalValue?: string;
}
export interface BatchUpdateMessage {
    type: 'BATCH_UPDATE';
    payload: {
        updates: BatchUpdateItem[];
    };
    requestId?: string;
    timestamp?: number;
}
export interface AddToChatMessage {
    type: 'ADD_TO_CHAT';
    payload: {
        content: string;
        context?: {
            elementInfo?: ElementInfo;
            sourceInfo?: SourceInfo;
        };
    };
    requestId?: string;
    timestamp?: number;
}
export interface CopyElementMessage {
    type: 'COPY_ELEMENT';
    payload: {
        elementInfo: {
            tagName: string;
            className: string;
            content: string;
            sourceInfo?: SourceInfo;
        };
        textContent: string;
        success: boolean;
        error?: string;
    };
    requestId?: string;
    timestamp?: number;
}
export interface ErrorMessage {
    type: 'ERROR';
    payload: {
        code: string;
        message: string;
        details?: any;
    };
    requestId?: string;
    timestamp?: number;
}
export interface AcknowledgementMessage {
    type: 'ACKNOWLEDGEMENT';
    payload: {
        messageType: string;
    };
    requestId: string;
    timestamp?: number;
}
export interface HeartbeatMessage {
    type: 'HEARTBEAT';
    payload?: {
        timestamp: number;
    };
    timestamp?: number;
}
export interface HealthCheckMessage {
    type: 'HEALTH_CHECK';
    requestId?: string;
    timestamp?: number;
}
export interface HealthCheckResponseMessage {
    type: 'HEALTH_CHECK_RESPONSE';
    payload: {
        status: 'healthy' | 'unhealthy' | 'degraded' | 'connecting' | 'unnecessary';
        version?: string;
        uptime?: number;
        message?: string;
        response?: any;
        error?: string;
        isIframe?: boolean;
        isConnected?: boolean;
        origin?: string;
        userAgent?: string;
        location?: string;
    };
    requestId: string;
    timestamp?: number;
}
export type IframeToParentMessage = ElementSelectedMessage | ElementDeselectedMessage | ContentUpdatedMessage | StyleUpdatedMessage | DesignModeChangedMessage | ErrorMessage | AcknowledgementMessage | HeartbeatMessage | HealthCheckResponseMessage | BridgeReadyMessage | AddToChatMessage | CopyElementMessage | ContentUpdatedCallbackMessage;
export type ParentToIframeMessage = ToggleDesignModeMessage | UpdateStyleMessage | UpdateContentMessage | BatchUpdateMessage | HealthCheckMessage | HeartbeatMessage;
export type DesignModeMessage = IframeToParentMessage | ParentToIframeMessage;
export type RequestMessage = ParentToIframeMessage & {
    requestId: string;
    timestamp: number;
};
export type ResponseMessage = IframeToParentMessage & {
    requestId: string;
    success?: boolean;
    error?: string;
    timestamp: number;
};
export type RequestResponseMessage = RequestMessage | ResponseMessage | AcknowledgementMessage;
export interface MessageHandler<T extends DesignModeMessage = DesignModeMessage> {
    type: T['type'];
    handler: (message: T) => Promise<any> | any;
    validator?: MessageValidator;
}
export interface IframeModeConfig {
    enabled: boolean;
    hideUI: boolean;
    enableSelection: boolean;
    enableDirectEdit: boolean;
}
export interface BatchUpdateConfig {
    enabled: boolean;
    debounceMs: number;
}
export interface BridgeConfig {
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
    heartbeatInterval: number;
    debug: boolean;
}
export interface MessageUtilsInterface {
    generateRequestId: () => string;
    createTimestamp: () => number;
    isValidMessage: (message: any) => boolean;
    createResponse: <T extends IframeToParentMessage>(originalMessage: ParentToIframeMessage, payload: T extends {
        payload: infer P;
    } ? P : never, success?: boolean, error?: string) => T;
}
export interface BridgeInterface {
    send: <T extends DesignModeMessage>(message: T) => Promise<void>;
    sendWithResponse: <T extends DesignModeMessage, R extends DesignModeMessage>(message: T, responseType: R['type']) => Promise<R>;
    on: <T extends DesignModeMessage>(type: T['type'], handler: (message: T) => void) => void;
    off: (type: string, handler: Function) => void;
    isConnected: () => boolean;
    disconnect: () => void;
}
//# sourceMappingURL=messages.d.ts.map