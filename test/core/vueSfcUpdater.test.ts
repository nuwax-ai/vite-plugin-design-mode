import { describe, it, expect } from 'vitest';
import { applyVueSfcTemplateUpdate } from '../../src/core/vueSfcUpdater';

function getLineColumnByToken(source: string, token: string): { line: number; column: number } {
  const index = source.indexOf(token);
  if (index < 0) {
    throw new Error(`Token not found: ${token}`);
  }
  const prefix = source.slice(0, index);
  const lines = prefix.split('\n');
  return {
    line: lines.length,
    column: (lines[lines.length - 1] ?? '').length + 1,
  };
}

describe('vueSfcUpdater', () => {
  it('updates static class in Vue template', () => {
    const source = `<template>
  <section>
    <h1 class="title">Hello Vue</h1>
  </section>
</template>
<script setup lang="ts">
const noop = true;
</script>
`;
    const { line, column } = getLineColumnByToken(source, '<h1');
    const updated = applyVueSfcTemplateUpdate(source, {
      lineNumber: line,
      columnNumber: column,
      type: 'style',
      newValue: 'title text-2xl',
    });

    expect(updated).toContain('<h1 class="title text-2xl">Hello Vue</h1>');
  });

  it('updates static text in Vue template', () => {
    const source = `<template>
  <section>
    <p>Hello Vue</p>
  </section>
</template>
<script setup>
const noop = true;
</script>
`;
    const { line, column } = getLineColumnByToken(source, '<p');
    const updated = applyVueSfcTemplateUpdate(source, {
      lineNumber: line,
      columnNumber: column,
      type: 'content',
      originalValue: 'Hello Vue',
      newValue: 'Hello Agent',
    });

    expect(updated).toContain('<p>Hello Agent</p>');
  });
});
