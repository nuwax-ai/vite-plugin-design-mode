import * as fs from 'fs';
import path from 'path';
import { IncomingMessage, ServerResponse } from 'http';

export interface UpdateRequest {
  filePath: string;
  line: number;
  column: number;
  newValue: string;
  type: 'style' | 'content';
  originalValue?: string; // Original value for matching/replacement
}

export function performUpdate(root: string, data: UpdateRequest): { success: boolean, message: string } {
  const { filePath, newValue, type, originalValue } = data;

  // Resolve absolute path
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);

  // Security: Validate path is within project root (prevent path traversal)
  if (!isPathWithinRoot(root, absolutePath)) {
    console.error('[appdev-design-mode] Security: Path traversal attempt blocked:', absolutePath);
    return { success: false, message: 'Access denied: path outside project root' };
  }

  if (!fs.existsSync(absolutePath)) {
    console.error('[appdev-design-mode] File not found:', absolutePath);
    return { success: false, message: 'File not found' };
  }

  // Security: Check file size limit (10MB)
  const stats = fs.statSync(absolutePath);
  const maxFileSize = 10 * 1024 * 1024; // 10MB
  if (stats.size > maxFileSize) {
    console.error('[appdev-design-mode] File too large:', absolutePath, stats.size);
    return { success: false, message: 'File too large (max 10MB)' };
  }

  // Security: Validate file extension (only allow source files)
  const allowedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.vue'];
  const ext = path.extname(absolutePath).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    console.error('[appdev-design-mode] Invalid file type:', absolutePath);
    return { success: false, message: 'Invalid file type' };
  }

  // Security: Validate newValue length (prevent DoS)
  const maxValueLength = 100000; // 100KB
  if (newValue.length > maxValueLength) {
    console.error('[appdev-design-mode] Value too large:', newValue.length);
    return { success: false, message: 'Value too large (max 100KB)' };
  }

  let sourceCode = fs.readFileSync(absolutePath, 'utf-8');
  let updated = false;

  if (type === 'content') {
    if (originalValue && originalValue !== newValue) {
      // Try to match with original value first
      const escapedOriginal = originalValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(>\\s*)${escapedOriginal}(\\s*<)`, 'g');

      const newSourceCode = sourceCode.replace(regex, `$1${newValue}$2`);

      if (newSourceCode !== sourceCode) {
        fs.writeFileSync(absolutePath, newSourceCode, 'utf-8');
        updated = true;
      } else {
        // Fallback: If original value not found, try to find any similar content
        // This handles cases where the file was already updated by HMR
        console.warn('[appdev-design-mode] Original value not found, trying fallback match');

        // Try to find the new value in the file (maybe it's already there)
        if (sourceCode.includes(newValue)) {
          updated = true; // Consider it successful since the desired state is already there
        }
      }
    } else if (originalValue === newValue) {
      // No change needed
      updated = true;
    } else {
      console.warn('[appdev-design-mode] Missing originalValue for content update');
    }
  } else if (type === 'style') {
    // TODO: Full style update pipeline
    // Simple implementation: find className="..." and replace (AST would be more robust)
    if (originalValue) {
       // Try className="originalValue"
       const escapedOriginal = originalValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
       // Matches className="...", class="...", className={...}, etc.; simplified to className="value"
       const regex = new RegExp(`(className=["'])${escapedOriginal}(["'])`, 'g');
       const newSourceCode = sourceCode.replace(regex, `$1${newValue}$2`);

       if (newSourceCode !== sourceCode) {
         fs.writeFileSync(absolutePath, newSourceCode, 'utf-8');
         updated = true;
       }
    } else {
      // Style update requires originalValue (current implementation)
    }
  }

  if (updated) {
    return { success: true, message: 'File updated successfully' };
  } else {
    console.warn('[appdev-design-mode] Could not update file - no match found');
    return { success: false, message: 'Could not locate content to update' };
  }
}

export async function handleUpdate(req: IncomingMessage, res: ServerResponse, root: string) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  const body = await readBody(req);
  try {
    const data = JSON.parse(body) as UpdateRequest;
    const result = performUpdate(root, data);

    if (result.success) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    } else {
      res.statusCode = 400;
      res.end(JSON.stringify(result));
    }

  } catch (error) {
    console.error('[appdev-design-mode] Error handling update:', error);
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: String(error) }));
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(body);
    });
    req.on('error', reject);
  });
}

function isPathWithinRoot(rootDir: string, targetPath: string): boolean {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(targetPath);
  if (resolvedRoot === resolvedTarget) {
    return true;
  }
  const relativePath = path.relative(resolvedRoot, resolvedTarget);
  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}
