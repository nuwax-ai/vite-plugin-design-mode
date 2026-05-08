import * as babel from '@babel/standalone';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { DesignModeOptions } from '../types';

export interface SourceMappingInfo {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
  elementType: string;
  componentName?: string;
  functionName?: string;
  elementId: string;
  attributePrefix: string;
  importPath?: string; // Resolved import path for the component
  isUIComponent?: boolean; // True when file is under components/ui (UI kit)
}


export interface JSXElementWithLoc extends t.JSXOpeningElement {
  loc: t.SourceLocation;
}

// PluginItem type from Babel
type PluginItem = any;
type NodePath = any;

/**
 * Whether the source file lives under a UI-kit folder (components/ui).
 * Runtime selection prefers usage site over definition for these.
 */
function isUIComponentFile(filePath: string): boolean {
  // Match /components/ui/ or \components\ui\
  return /[/\\]components[/\\]ui[/\\]/.test(filePath);
}

/**
 * Babel plugin factory: inject source-mapping data attributes.
 */
export function createSourceMappingPlugin(
  fileName: string,
  options: Required<DesignModeOptions>
): PluginItem {
  const { attributePrefix } = options;
  const imports: Record<string, string> = {}; // local name -> module specifier

  return {
    visitor: {
      // 1) Collect import bindings
      ImportDeclaration(path: NodePath) {
        const { node } = path;
        const sourceValue = node.source.value; // e.g. "@/components/ui/button"

        node.specifiers.forEach((specifier: any) => {
          if (t.isImportSpecifier(specifier)) {
            // import { Button } from ...
            imports[specifier.local.name] = sourceValue;
            // console.log(`[DesignMode] Found import: ${specifier.local.name} from ${sourceValue}`);
          } else if (t.isImportDefaultSpecifier(specifier)) {
            // import Button from ...
            imports[specifier.local.name] = sourceValue;
            // console.log(`[DesignMode] Found default import: ${specifier.local.name} from ${sourceValue}`);
          } else if (t.isImportNamespaceSpecifier(specifier)) {
            // import * as UI from ...
            imports[specifier.local.name] = sourceValue;
          }
        });
      },

      JSXOpeningElement(path: NodePath) {
        const { node } = path;

        const location = node.loc;
        if (!location) return;

        const componentInfo = extractComponentInfo(path);
        const elementType = getJSXElementName(node.name);

        // Resolve import path for JSX name (member expr uses object part only)
        let importPath: string | undefined;
        if (t.isJSXIdentifier(node.name)) {
          importPath = imports[node.name.name];
        } else if (t.isJSXMemberExpression(node.name) && t.isJSXIdentifier(node.name.object)) {
          importPath = imports[node.name.object.name];
        }

        // if (importPath) {
        //   console.log(`[DesignMode] Injecting importPath for ${elementType}: ${importPath}`);
        // }

        const isUIComponent = isUIComponentFile(fileName);

        const sourceInfo: SourceMappingInfo = {
          fileName: fileName,
          lineNumber: location.start.line,
          columnNumber: location.start.column,
          elementType: elementType,
          componentName: componentInfo.componentName,
          functionName: componentInfo.functionName,
          elementId: generateElementId(node, fileName, location),
          attributePrefix,
          importPath,
          isUIComponent
        };


        addSourceInfoAttribute(node, sourceInfo, options);

        addPositionAttribute(node, location, options);

        addElementIdAttribute(node, sourceInfo, options);

        // Optional: extra per-field attrs (disabled to keep DOM small; info JSON holds all)
        // addIndividualAttributes(node, sourceInfo, options);

        // Check if content is static and add attribute
        if (isStaticContent(path)) {
          addStaticContentAttribute(node, path, options);
        }

        // Check if className is static (pure string literal) and add attribute
        if (isStaticClassName(node)) {
          addStaticClassAttribute(node, options);
        }
      },

      JSXElement(path: NodePath) {
        const { node } = path;
        const { openingElement, children } = node;

        if (!children || children.length === 0) return;

        const hasStaticText = children.some((child: any) => t.isJSXText(child) && child.value.trim() !== '');

        if (hasStaticText) {
          const textChild = children.find((child: any) => t.isJSXText(child) && child.value.trim() !== '');
          if (textChild && textChild.loc) {
            // children-source: where static text came from (for pass-through components)
            const childrenSourceValue = `${fileName}:${textChild.loc.start.line}:${textChild.loc.start.column}`;
            const attributeName = `${attributePrefix}-children-source`;

            openingElement.attributes.push(
              t.jsxAttribute(
                t.jsxIdentifier(attributeName),
                t.stringLiteral(childrenSourceValue)
              )
            );
          }
        }
      }
    }
  };
}

/**
 * Best-effort enclosing React component / function name.
 */
function extractComponentInfo(path: NodePath): { componentName?: string; functionName?: string } {
  const componentInfo: { componentName?: string; functionName?: string } = {};

  // Nearest function or class
  const functionParent = path.findParent((p: NodePath) =>
    t.isFunctionDeclaration(p.node) ||
    t.isArrowFunctionExpression(p.node) ||
    t.isClassDeclaration(p.node)
  );

  if (functionParent) {
    const node = functionParent.node;

    if (t.isFunctionDeclaration(node) && node.id?.name) {
      componentInfo.functionName = node.id.name;
      // React: components are PascalCase
      if (/^[A-Z]/.test(node.id.name)) {
        componentInfo.componentName = node.id.name;
      }
    } else if (t.isArrowFunctionExpression(node)) {
      componentInfo.functionName = 'anonymous-arrow-function';
    } else if (t.isClassDeclaration(node) && node.id?.name) {
      componentInfo.functionName = node.id.name;
      componentInfo.componentName = node.id.name;
    }
  }

  // Fallback: const Foo = ...
  const variableParent = path.findParent((p: NodePath) =>
    t.isVariableDeclarator(p.node)
  );

  if (variableParent && t.isVariableDeclarator(variableParent.node)) {
    const id = variableParent.node.id;
    if (t.isIdentifier(id)) {
      componentInfo.functionName = id.name;
      if (/^[A-Z]/.test(id.name)) {
        componentInfo.componentName = id.name;
      }
    }
  }

  return componentInfo;
}

/**
 * JSX tag name as string (identifier or member root).
 */
function getJSXElementName(name: any): string {
  if (t.isJSXIdentifier(name)) {
    return name.name;
  } else if (t.isJSXMemberExpression(name)) {
    return `${getJSXElementName(name.object)}`;
  }
  return 'unknown';
}

/**
 * Stable id: file:line:col_tag#id
 */
function generateElementId(node: t.JSXOpeningElement, fileName: string, location: t.SourceLocation): string {
  const tagName = getJSXElementName(node.name);

  // const className = extractStringAttribute(node, 'className'); // omitted to shorten id
  const id = extractStringAttribute(node, 'id');

  const baseId = `${fileName}:${location.start.line}:${location.start.column}`;
  const tag = tagName.toLowerCase();
  // const cls = className ? className.replace(/\s+/g, '-') : '';
  const elementId = id ? `#${id}` : '';

  // return `${baseId}_${tag}${cls ? '_' + cls : ''}${elementId}`;
  return `${baseId}_${tag}${elementId}`;
}

/**
 * String literal JSX attribute value, if any.
 */
function extractStringAttribute(node: t.JSXOpeningElement, attributeName: string): string | null {
  const attr = node.attributes.find(a =>
    t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === attributeName
  ) as t.JSXAttribute;

  if (attr && t.isStringLiteral(attr.value)) {
    return attr.value.value;
  }

  return null;
}

/**
 * Inject compact JSON on `{prefix}-info`.
 */
function addSourceInfoAttribute(node: t.JSXOpeningElement, sourceInfo: SourceMappingInfo, options: Required<DesignModeOptions>) {
  const { attributePrefix } = options;

  // Remove previous info attr
  node.attributes = node.attributes.filter(a =>
    !(t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === `${attributePrefix}-info`)
  );

  // Push new JSON attr
  const attr = t.jSXAttribute(
    t.jSXIdentifier(`${attributePrefix}-info`),
    t.stringLiteral(JSON.stringify({
      fileName: sourceInfo.fileName,
      lineNumber: sourceInfo.lineNumber,
      columnNumber: sourceInfo.columnNumber,
      elementType: sourceInfo.elementType,
      componentName: sourceInfo.componentName,
      functionName: sourceInfo.functionName,
      elementId: sourceInfo.elementId,
      importPath: sourceInfo.importPath,
      isUIComponent: sourceInfo.isUIComponent
    }))
  );

  node.attributes.unshift(attr);
}

/**
 * `{prefix}-position` shorthand.
 */
function addPositionAttribute(node: t.JSXOpeningElement, location: t.SourceLocation, options: Required<DesignModeOptions>) {
  const { attributePrefix } = options;

  node.attributes = node.attributes.filter(a =>
    !(t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === `${attributePrefix}-position`)
  );

  const attr = t.jSXAttribute(
    t.jSXIdentifier(`${attributePrefix}-position`),
    t.stringLiteral(`${location.start.line}:${location.start.column}`)
  );

  node.attributes.unshift(attr);
}

/**
 * `{prefix}-element-id`.
 */
function addElementIdAttribute(node: t.JSXOpeningElement, sourceInfo: SourceMappingInfo, options: Required<DesignModeOptions>) {
  const { attributePrefix } = options;

  node.attributes = node.attributes.filter(a =>
    !(t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === `${attributePrefix}-element-id`)
  );

  const attr = t.jSXAttribute(
    t.jSXIdentifier(`${attributePrefix}-element-id`),
    t.stringLiteral(sourceInfo.elementId)
  );

  node.attributes.unshift(attr);
}

/**
 * Legacy: one attribute per field (debug / queries).
 */
function addIndividualAttributes(node: t.JSXOpeningElement, sourceInfo: SourceMappingInfo, options: Required<DesignModeOptions>) {
  const { attributePrefix } = options;

  // Helper to add attribute if it doesn't exist
  const addAttr = (name: string, value: string | number | undefined) => {
    if (value === undefined) return;

    node.attributes = node.attributes.filter(a =>
      !(t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === name)
    );

    node.attributes.unshift(t.jSXAttribute(
      t.jSXIdentifier(name),
      t.stringLiteral(String(value))
    ));
  };

  addAttr(`${attributePrefix}-file`, sourceInfo.fileName);
  addAttr(`${attributePrefix}-line`, sourceInfo.lineNumber);
  addAttr(`${attributePrefix}-column`, sourceInfo.columnNumber);
  addAttr(`${attributePrefix}-component`, sourceInfo.componentName);
  addAttr(`${attributePrefix}-function`, sourceInfo.functionName);
  addAttr(`${attributePrefix}-import`, sourceInfo.importPath);
}

/**
 * True only when children are exclusively JSXText (no expr containers, nested tags, etc.).
 */
function isStaticContent(path: NodePath): boolean {
  const { node } = path;
  const element = path.parent; // JSXElement

  if (!t.isJSXElement(element)) return false;

  if (element.children.length === 0) return false;

  return element.children.every(child => {
    if (t.isJSXText(child)) {
      return true;
    }

    return false;
  });
}

/**
 * `{prefix}-static-content="true"` when children are pure JSXText.
 */
function addStaticContentAttribute(node: t.JSXOpeningElement, path: NodePath, options: Required<DesignModeOptions>) {
  const { attributePrefix } = options;
  const attributeName = `${attributePrefix}-static-content`;

  if (!isStaticContent(path)) {
    return;
  }

  // Check if attribute already exists
  const hasAttr = node.attributes.some(a =>
    t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === attributeName
  );

  if (!hasAttr) {
    node.attributes.unshift(t.jSXAttribute(
      t.jSXIdentifier(attributeName),
      t.stringLiteral('true')
    ));
  }
}

/**
 * Static className: absent, string literal, or expr with only static string/template without expressions.
 * Dynamic: variables, cn(), conditional expr, template with ${}, etc.
 */
function isStaticClassName(node: t.JSXOpeningElement): boolean {
  const classNameAttr = node.attributes.find(attr =>
    t.isJSXAttribute(attr) &&
    t.isJSXIdentifier(attr.name) &&
    attr.name.name === 'className'
  ) as t.JSXAttribute | undefined;

  if (!classNameAttr) {
    return true;
  }

  const value = classNameAttr.value;

  if (t.isStringLiteral(value)) {
    return true;
  }

  if (t.isJSXExpressionContainer(value)) {
    const expression = value.expression;

    if (t.isStringLiteral(expression)) {
      return true;
    }

    if (t.isTemplateLiteral(expression)) {
      if (expression.expressions.length === 0) {
        return true;
      }
    }

    return false;
  }

  return true;
}

/**
 * `{prefix}-static-class="true"` when className is static per `isStaticClassName`.
 */
function addStaticClassAttribute(node: t.JSXOpeningElement, options: Required<DesignModeOptions>) {
  const { attributePrefix } = options;
  const attributeName = `${attributePrefix}-static-class`;

  // Check if attribute already exists
  const hasAttr = node.attributes.some(a =>
    t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === attributeName
  );

  if (!hasAttr) {
    node.attributes.unshift(t.jSXAttribute(
      t.jSXIdentifier(attributeName),
      t.stringLiteral('true')
    ));
  }
}
