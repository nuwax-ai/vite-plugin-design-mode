import type { Plugin } from 'vite';

export interface DesignModeOptions {
  enabled?: boolean;
  enableInProduction?: boolean;
  attributePrefix?: string;
  verbose?: boolean;
  exclude?: string[];
  include?: string[];
  enableBackup?: boolean; // Enable file backups (default false)
  enableHistory?: boolean; // Enable update history (default false)
}

export interface SourceMappingInfo {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
  elementType: string;
  componentName?: string;
  functionName?: string;
  elementId: string;
  attributePrefix: string;
}

export interface ElementSourceRequest {
  elementId: string;
}

export interface ElementSourceResponse {
  sourceInfo: SourceMappingInfo & {
    fileContent: string;
    contextLines: string;
    targetLineContent: string;
  };
}

export interface ElementModifyRequest {
  elementId: string;
  newStyles: string;
  oldStyles?: string;
}

export interface ElementModifyResponse {
  success: boolean;
  message: string;
  sourceInfo: SourceMappingInfo;
}

// Type declaration for module exports
declare const _default: (options?: DesignModeOptions) => Plugin;

export default _default;
