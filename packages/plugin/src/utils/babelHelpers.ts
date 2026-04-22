import * as t from '@babel/types';

/**
 * Whether the name looks like a React component (PascalCase).
 */
export function isReactComponentName(name: string): boolean {
  return /^[A-Z]/.test(name);
}

/**
 * Base name of a JSX element (identifier or member property).
 */
export function getJSXElementBaseName(name: any): string {
  if (t.isJSXIdentifier(name)) {
    return name.name;
  } else if (t.isJSXMemberExpression(name)) {
    return name.property.name;
  }
  return 'unknown';
}

/**
 * Whether a JSX attribute is a string literal for the given name.
 */
export function isStringLiteralAttribute(
  attr: t.JSXAttribute,
  name: string
): attr is t.JSXAttribute & { value: t.StringLiteral } {
  return (
    t.isJSXIdentifier(attr.name) &&
    attr.name.name === name &&
    t.isStringLiteral(attr.value)
  );
}

/**
 * Read a string literal attribute value from a JSX opening element.
 */
export function extractStringAttributeValue(
  node: t.JSXOpeningElement,
  attributeName: string
): string | null {
  const attr = node.attributes.find(a => 
    t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === attributeName
  ) as t.JSXAttribute;
  
  if (attr && t.isStringLiteral(attr.value)) {
    return attr.value.value;
  }
  
  return null;
}

/**
 * Serialize file:line:column into a single string.
 */
export function createSourcePositionString(
  fileName: string,
  lineNumber: number,
  columnNumber: number
): string {
  return `${fileName}:${lineNumber}:${columnNumber}`;
}

/**
 * Parse a file:line:column string back into parts.
 */
export function parseSourcePositionString(position: string): {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
} | null {
  const parts = position.split(':');
  if (parts.length !== 3) return null;
  
  const [fileName, lineNumberStr, columnNumberStr] = parts;
  const lineNumber = parseInt(lineNumberStr);
  const columnNumber = parseInt(columnNumberStr);
  
  if (isNaN(lineNumber) || isNaN(columnNumber)) return null;
  
  return {
    fileName,
    lineNumber,
    columnNumber
  };
}
