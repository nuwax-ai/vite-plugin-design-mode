import { describe, it, expect } from 'vitest';
import {
  isReactComponentName,
  getJSXElementBaseName,
  isStringLiteralAttribute,
  extractStringAttributeValue,
  createSourcePositionString,
  parseSourcePositionString,
} from '../../packages/plugin/src/utils/babelHelpers';
import * as t from '@babel/types';

describe('babelHelpers', () => {
  describe('isReactComponentName', () => {
    it('应该识别大写开头的组件名', () => {
      expect(isReactComponentName('App')).toBe(true);
      expect(isReactComponentName('Button')).toBe(true);
      expect(isReactComponentName('MyComponent')).toBe(true);
    });

    it('应该识别小写开头的非组件名', () => {
      expect(isReactComponentName('app')).toBe(false);
      expect(isReactComponentName('button')).toBe(false);
      expect(isReactComponentName('myComponent')).toBe(false);
    });

    it('应该处理特殊字符', () => {
      expect(isReactComponentName('_App')).toBe(false);
      expect(isReactComponentName('$Component')).toBe(false);
      expect(isReactComponentName('123Component')).toBe(false);
    });
  });

  describe('getJSXElementBaseName', () => {
    it('应该从JSXIdentifier获取名称', () => {
      const identifier = t.jSXIdentifier('div');
      const name = getJSXElementBaseName(identifier);
      expect(name).toBe('div');
    });

    it('应该从JSXMemberExpression获取属性名', () => {
      const memberExpr = t.jSXMemberExpression(
        t.jSXIdentifier('React'),
        t.jSXIdentifier('Component')
      );
      const name = getJSXElementBaseName(memberExpr);
      expect(name).toBe('Component');
    });

    it('应该处理未知类型', () => {
      const unknown = t.stringLiteral('test');
      const name = getJSXElementBaseName(unknown as any);
      expect(name).toBe('unknown');
    });
  });

  describe('isStringLiteralAttribute', () => {
    it('应该识别字符串字面量属性', () => {
      const attr = t.jSXAttribute(
        t.jSXIdentifier('className'),
        t.stringLiteral('test')
      );
      
      const result = isStringLiteralAttribute(attr, 'className');
      expect(result).toBe(true);
    });

    it('应该识别非字符串字面量属性', () => {
      const attr = t.jSXAttribute(
        t.jSXIdentifier('className'),
        t.jSXExpressionContainer(t.identifier('classNameVar'))
      );
      
      const result = isStringLiteralAttribute(attr, 'className');
      expect(result).toBe(false);
    });

    it('应该识别属性名不匹配的情况', () => {
      const attr = t.jSXAttribute(
        t.jSXIdentifier('id'),
        t.stringLiteral('test')
      );
      
      const result = isStringLiteralAttribute(attr, 'className');
      expect(result).toBe(false);
    });
  });

  describe('extractStringAttributeValue', () => {
    it('应该提取字符串属性值', () => {
      const openingElement = t.jSXOpeningElement(
        t.jSXIdentifier('div'),
        [
          t.jSXAttribute(
            t.jSXIdentifier('className'),
            t.stringLiteral('container')
          ),
        ]
      );
      
      const value = extractStringAttributeValue(openingElement, 'className');
      expect(value).toBe('container');
    });

    it('应该返回null当属性不存在时', () => {
      const openingElement = t.jSXOpeningElement(
        t.jSXIdentifier('div'),
        []
      );
      
      const value = extractStringAttributeValue(openingElement, 'className');
      expect(value).toBeNull();
    });

    it('应该返回null当属性不是字符串字面量时', () => {
      const openingElement = t.jSXOpeningElement(
        t.jSXIdentifier('div'),
        [
          t.jSXAttribute(
            t.jSXIdentifier('className'),
            t.jSXExpressionContainer(t.identifier('classNameVar'))
          ),
        ]
      );
      
      const value = extractStringAttributeValue(openingElement, 'className');
      expect(value).toBeNull();
    });

    it('应该提取id属性值', () => {
      const openingElement = t.jSXOpeningElement(
        t.jSXIdentifier('div'),
        [
          t.jSXAttribute(
            t.jSXIdentifier('id'),
            t.stringLiteral('app')
          ),
        ]
      );
      
      const value = extractStringAttributeValue(openingElement, 'id');
      expect(value).toBe('app');
    });
  });

  describe('createSourcePositionString', () => {
    it('应该创建正确的位置字符串', () => {
      const position = createSourcePositionString('src/App.tsx', 10, 5);
      expect(position).toBe('src/App.tsx:10:5');
    });

    it('应该处理不同的文件名', () => {
      const position = createSourcePositionString('components/Button.tsx', 20, 15);
      expect(position).toBe('components/Button.tsx:20:15');
    });

    it('应该处理行号和列号为0的情况', () => {
      const position = createSourcePositionString('test.tsx', 0, 0);
      expect(position).toBe('test.tsx:0:0');
    });
  });

  describe('parseSourcePositionString', () => {
    it('应该解析正确的位置字符串', () => {
      const result = parseSourcePositionString('src/App.tsx:10:5');
      
      expect(result).not.toBeNull();
      expect(result?.fileName).toBe('src/App.tsx');
      expect(result?.lineNumber).toBe(10);
      expect(result?.columnNumber).toBe(5);
    });

    it('应该处理不同的文件名', () => {
      const result = parseSourcePositionString('components/Button.tsx:20:15');
      
      expect(result).not.toBeNull();
      expect(result?.fileName).toBe('components/Button.tsx');
      expect(result?.lineNumber).toBe(20);
      expect(result?.columnNumber).toBe(15);
    });

    it('应该返回null当格式不正确时', () => {
      expect(parseSourcePositionString('invalid')).toBeNull();
      expect(parseSourcePositionString('src/App.tsx:10')).toBeNull();
      expect(parseSourcePositionString('src/App.tsx:10:5:extra')).toBeNull();
    });

    it('应该返回null当行号或列号不是数字时', () => {
      expect(parseSourcePositionString('src/App.tsx:abc:5')).toBeNull();
      expect(parseSourcePositionString('src/App.tsx:10:def')).toBeNull();
      expect(parseSourcePositionString('src/App.tsx:abc:def')).toBeNull();
    });

    it('应该处理行号和列号为0的情况', () => {
      const result = parseSourcePositionString('test.tsx:0:0');
      
      expect(result).not.toBeNull();
      expect(result?.lineNumber).toBe(0);
      expect(result?.columnNumber).toBe(0);
    });

    it('应该处理负数行号或列号', () => {
      // 虽然负数在实际情况中不应该出现，但函数应该能处理
      const result = parseSourcePositionString('test.tsx:-1:-1');
      
      expect(result).not.toBeNull();
      expect(result?.lineNumber).toBe(-1);
      expect(result?.columnNumber).toBe(-1);
    });
  });
});

