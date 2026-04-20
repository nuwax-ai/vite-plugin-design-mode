import { parse as parseSfc } from '@vue/compiler-sfc';
import { NodeTypes, parse as parseTemplate } from '@vue/compiler-dom';

type UpdateKind = 'style' | 'content' | 'attribute';

export interface VueSfcUpdateOptions {
  lineNumber: number;
  columnNumber: number;
  newValue: string;
  originalValue?: string;
  type: UpdateKind;
}

interface SourceSpan {
  start: number;
  end: number;
}

export function applyVueSfcTemplateUpdate(
  source: string,
  options: VueSfcUpdateOptions
): string {
  const sfc = parseSfc(source, { filename: 'component.vue' });
  const templateBlock = sfc.descriptor.template;
  if (!templateBlock) {
    throw new Error('Vue SFC missing <template> block.');
  }

  const templateStartOffset = templateBlock.loc.start.offset;
  const templateSource = templateBlock.content;
  const targetOffsetInFile = getOffsetFromLineColumn(source, options.lineNumber, options.columnNumber);
  const targetOffsetInTemplate = targetOffsetInFile - templateStartOffset;
  if (targetOffsetInTemplate < 0 || targetOffsetInTemplate > templateSource.length) {
    throw new Error('Target position is outside <template> block.');
  }

  const ast = parseTemplate(templateSource, { comments: true });
  const targetElement = findElementByPosition(ast, targetOffsetInTemplate);
  if (!targetElement) {
    throw new Error('Unable to locate target element in Vue template AST.');
  }

  switch (options.type) {
    case 'style':
      return updateElementClass(source, templateStartOffset, targetElement, options.newValue);
    case 'content':
      return updateElementTextContent(source, templateStartOffset, targetElement, options.newValue, options.originalValue);
    case 'attribute':
      throw new Error('Vue attribute update is not supported in AST mode yet.');
    default:
      return source;
  }
}

function updateElementClass(
  fullSource: string,
  templateStartOffset: number,
  elementNode: any,
  newClassValue: string
): string {
  const classAttr = elementNode.props.find(
    (prop: any) => prop.type === NodeTypes.ATTRIBUTE && prop.name === 'class'
  );
  if (classAttr?.value?.loc) {
    const valueLoc = toFullFileSpan(templateStartOffset, classAttr.value.loc.start.offset, classAttr.value.loc.end.offset);
    const originalValueSource = fullSource.slice(valueLoc.start, valueLoc.end);
    const quoteChar = originalValueSource.startsWith("'") ? "'" : '"';
    const escaped = escapeAttributeValue(newClassValue, quoteChar);
    return replaceSpan(fullSource, valueLoc, `${quoteChar}${escaped}${quoteChar}`);
  }

  const classBind = elementNode.props.find(
    (prop: any) => prop.type === NodeTypes.DIRECTIVE && prop.name === 'bind' && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION && prop.arg.content === 'class'
  );
  if (classBind?.exp?.type === NodeTypes.SIMPLE_EXPRESSION && classBind.exp.isStatic) {
    const bindLoc = toFullFileSpan(templateStartOffset, classBind.loc.start.offset, classBind.loc.end.offset);
    return replaceSpan(fullSource, bindLoc, `class="${escapeAttributeValue(newClassValue)}"`);
  }
  if (classBind) {
    throw new Error('Dynamic :class expression is not safely editable in Vue AST mode.');
  }

  const insertOffset = templateStartOffset + elementNode.loc.start.offset + `<${elementNode.tag}`.length;
  return `${fullSource.slice(0, insertOffset)} class="${escapeAttributeValue(newClassValue)}"${fullSource.slice(insertOffset)}`;
}

function updateElementTextContent(
  fullSource: string,
  templateStartOffset: number,
  elementNode: any,
  newText: string,
  originalValue?: string
): string {
  const textChild = elementNode.children.find(
    (child: any) => child.type === NodeTypes.TEXT && child.content.trim().length > 0
  );
  if (!textChild?.loc) {
    throw new Error('Target Vue element has no editable static text node.');
  }

  const currentText = textChild.content;
  if (originalValue && !currentText.includes(originalValue)) {
    throw new Error('Original text does not match current Vue template text.');
  }

  const replacement = originalValue
    ? currentText.replace(new RegExp(escapeRegExp(originalValue), 'g'), newText)
    : newText;
  const textLoc = toFullFileSpan(templateStartOffset, textChild.loc.start.offset, textChild.loc.end.offset);
  return replaceSpan(fullSource, textLoc, replacement);
}

function findElementByPosition(ast: any, targetOffset: number): any | null {
  let matched: any | null = null;

  const visit = (node: any) => {
    if (!node?.loc?.start || !node?.loc?.end) {
      return;
    }
    if (targetOffset < node.loc.start.offset || targetOffset > node.loc.end.offset) {
      return;
    }
    if (node.type === NodeTypes.ELEMENT) {
      matched = node;
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        visit(child);
      }
    }
  };

  for (const child of ast.children ?? []) {
    visit(child);
  }

  return matched;
}

function getOffsetFromLineColumn(source: string, line: number, column: number): number {
  const lines = source.split('\n');
  if (line < 1 || line > lines.length) {
    throw new Error(`Line ${line} exceeds source length.`);
  }
  const targetLine = lines[line - 1] ?? '';
  if (column < 1 || column > targetLine.length + 1) {
    throw new Error(`Column ${column} is invalid for line ${line}.`);
  }
  let offset = 0;
  for (let i = 0; i < line - 1; i++) {
    offset += (lines[i] ?? '').length + 1;
  }
  return offset + (column - 1);
}

function toFullFileSpan(templateStart: number, start: number, end: number): SourceSpan {
  return {
    start: templateStart + start,
    end: templateStart + end,
  };
}

function replaceSpan(source: string, span: SourceSpan, replacement: string): string {
  return `${source.slice(0, span.start)}${replacement}${source.slice(span.end)}`;
}

function escapeAttributeValue(value: string, quoteChar: '"' | "'" = '"'): string {
  if (quoteChar === "'") {
    return value.replace(/'/g, '&#39;');
  }
  return value.replace(/"/g, '&quot;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
