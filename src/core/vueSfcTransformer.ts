import { NodeTypes, parse as parseTemplate } from '@vue/compiler-dom';
import { parse as parseSfc } from '@vue/compiler-sfc';
import type { DesignModeOptions } from '../types';

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getLineAndColumnFromIndex(source: string, index: number): { line: number; column: number } {
  const safeIndex = Math.max(0, Math.min(index, source.length));
  const prefix = source.slice(0, safeIndex);
  const lines = prefix.split('\n');
  return {
    line: lines.length,
    column: (lines[lines.length - 1] ?? '').length + 1,
  };
}

export function transformVueSfcTemplate(
  code: string,
  id: string,
  options: Required<DesignModeOptions>
): string {
  const sfc = parseSfc(code, { filename: id });
  const templateBlock = sfc.descriptor.template;
  if (!templateBlock) {
    return code;
  }

  const templateContent = templateBlock.content;
  const attrPrefix = options.attributePrefix;
  const existingAttrPattern = new RegExp(
    `\\s${attrPrefix}-[\\w-]+=(?:"[^"]*"|'[^']*')`,
    'g'
  );
  const cleanedTemplate = templateContent.replace(existingAttrPattern, '');
  const templateBaseOffset = templateBlock.loc.start.offset;
  const ast = parseTemplate(cleanedTemplate, { comments: true });

  const insertions: Array<{ offset: number; text: string }> = [];
  let elementIndex = 0;

  const visit = (node: any) => {
    if (!node || node.type !== NodeTypes.ELEMENT) {
      if (Array.isArray(node?.children)) {
        node.children.forEach(visit);
      }
      return;
    }

    const tagName = String(node.tag);
    const startTagEndInTemplate = findStartTagEndOffset(cleanedTemplate, node.loc.start.offset);
    if (startTagEndInTemplate < 0) {
      if (Array.isArray(node.children)) {
        node.children.forEach(visit);
      }
      return;
    }

    const absoluteStartOffset = templateBaseOffset + node.loc.start.offset;
    const { line, column } = getLineAndColumnFromIndex(code, absoluteStartOffset);
    const elementType = tagName.toLowerCase();
    const elementId = `${id}:${line}:${column}_${elementType}_${elementIndex++}`;
    const sourceInfo = {
      fileName: id,
      lineNumber: line,
      columnNumber: column,
      // Backward compatibility for old clients that still read `line`/`column`.
      line,
      column,
      elementId,
      elementType,
    };
    const infoAttr = escapeHtmlAttr(JSON.stringify(sourceInfo));
    const attrsToInject =
      ` ${attrPrefix}-info="${infoAttr}"` +
      ` ${attrPrefix}-position="${line}:${column}"` +
      ` ${attrPrefix}-element-id="${elementId}"`;

    insertions.push({
      offset: templateBaseOffset + startTagEndInTemplate,
      text: attrsToInject,
    });

    if (Array.isArray(node.children)) {
      node.children.forEach(visit);
    }
  };

  ast.children.forEach(visit);

  if (insertions.length === 0 && cleanedTemplate === templateContent) {
    return code;
  }

  let rebuilt = code.slice(0, templateBaseOffset) + cleanedTemplate + code.slice(templateBaseOffset + templateContent.length);
  insertions.sort((a, b) => b.offset - a.offset).forEach((entry) => {
    rebuilt = rebuilt.slice(0, entry.offset) + entry.text + rebuilt.slice(entry.offset);
  });

  return rebuilt;
}

function findStartTagEndOffset(source: string, startOffset: number): number {
  let index = startOffset;
  let quote: '"' | "'" | null = null;
  while (index < source.length) {
    const char = source[index];
    if (!quote && (char === '"' || char === "'")) {
      quote = char;
      index += 1;
      continue;
    }
    if (quote && char === quote) {
      quote = null;
      index += 1;
      continue;
    }
    if (!quote && char === '>') {
      if (index > startOffset && source[index - 1] === '/') {
        return index - 1;
      }
      return index;
    }
    index += 1;
  }
  return -1;
}
