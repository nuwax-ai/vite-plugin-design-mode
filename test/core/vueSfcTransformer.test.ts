import { describe, it, expect } from 'vitest';
import { transformVueSfcTemplate } from '../../packages/plugin/src/core/vueSfcTransformer';
import type { DesignModeOptions } from '../../packages/plugin/src/types';

const options: Required<DesignModeOptions> = {
  enabled: true,
  enableInProduction: false,
  attributePrefix: 'data-source',
  verbose: false,
  exclude: ['node_modules'],
  include: ['src/**/*.{js,jsx,ts,tsx,vue}'],
  enableBackup: false,
  enableHistory: false,
  framework: 'auto',
};

function decodeHtmlAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

describe('vueSfcTransformer', () => {
  it('injects normalized source info fields with legacy compatibility aliases', () => {
    const source = `<template>
  <div class="wrap">
    <h1>Hello Vue</h1>
  </div>
</template>
<script setup lang="ts">
const message = 'ok';
</script>
`;

    const transformed = transformVueSfcTemplate(source, 'src/pages/Home.vue', options);
    const attrMatch = transformed.match(/data-source-info="([^"]+)"/);

    expect(attrMatch).toBeTruthy();
    const sourceInfo = JSON.parse(decodeHtmlAttr(attrMatch![1])) as Record<string, unknown>;

    expect(sourceInfo.fileName).toBe('src/pages/Home.vue');
    expect(sourceInfo.lineNumber).toBeTypeOf('number');
    expect(sourceInfo.columnNumber).toBeTypeOf('number');
    expect(sourceInfo.line).toBe(sourceInfo.lineNumber);
    expect(sourceInfo.column).toBe(sourceInfo.columnNumber);
  });

  it('removes stale mapping attrs before reinjection', () => {
    const source = `<template>
  <div data-source-info="{&quot;fileName&quot;:&quot;old.vue&quot;}" data-source-position="1:1" data-source-element-id="old">
    Hello
  </div>
</template>`;

    const transformed = transformVueSfcTemplate(source, 'src/pages/Home.vue', options);
    const infoAttrs = transformed.match(/data-source-info=/g) ?? [];

    expect(infoAttrs.length).toBe(1);
    expect(transformed).not.toContain('old.vue');
  });
});
