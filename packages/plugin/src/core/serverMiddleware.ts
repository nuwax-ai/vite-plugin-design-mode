import type { ViteDevServer } from 'vite';
import type { DesignModeOptions } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { applyVueSfcTemplateUpdate } from './vueSfcUpdater';

export function createServerMiddleware(
  options: Required<DesignModeOptions>,
  rootDir: string
) {
  const enableBackup = options.enableBackup === true;
  const enableHistory = options.enableHistory === true;

  return async (req: any, res: any) => {
    const url = new URL(req.url, 'http://localhost');

    try {
      switch (url.pathname) {
        // Core endpoints
        case '/get-source':
          await handleGetSource(url, res, rootDir);
          break;
        case '/modify-source':
          await handleModifySource(req, res, rootDir);
          break;
        case '/health':
          await handleHealthCheck(res);
          break;

        // Extended endpoints
        case '/update':
          await handleUpdate(req, res, rootDir, enableBackup);
          break;
        case '/batch-update':
          await handleBatchUpdate(req, res, rootDir, enableBackup, enableHistory);
          break;
        case '/batch-update-status':
          await handleBatchUpdateStatus(req, res, rootDir, enableHistory);
          break;
        case '/undo':
          await handleUndo(req, res, rootDir, enableBackup);
          break;
        case '/redo':
          await handleRedo(req, res, rootDir);
          break;
        case '/get-history':
          await handleGetHistory(req, res, rootDir, enableHistory);
          break;
        case '/validate-update':
          await handleValidateUpdate(req, res, rootDir);
          break;

        default:
          res.statusCode = 404;
          res.end(JSON.stringify({
            error: 'Not found',
            requestedPath: url.pathname,
            availableEndpoints: [
              '/get-source',
              '/modify-source',
              '/update',
              '/batch-update',
              '/batch-update-status',
              '/undo',
              '/redo',
              '/get-history',
              '/validate-update',
              '/health'
            ]
          }));
      }
    } catch (error) {
      console.error('[DesignMode] Server middleware error:', error);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
        })
      );
    }
  };
}

/**
 * GET /get-source — enriched source snapshot for an element id.
 */
async function handleGetSource(url: URL, res: any, rootDir: string) {
  const elementId = url.searchParams.get('elementId');

  if (!elementId) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Missing elementId parameter' }));
    return;
  }

  try {
    // Parse elementId → file position
    const sourceInfo = parseElementId(elementId);

    if (!sourceInfo) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Invalid elementId format' }));
      return;
    }

    const filePath = path.resolve(rootDir, sourceInfo.fileName);

    // Security: Validate path is within project root (prevent path traversal)
    if (!isPathWithinRoot(rootDir, filePath)) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: 'Access denied: path outside project root' }));
      return;
    }

    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
    } catch {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Source file not found', filePath }));
      return;
    }

    const fileContent = await fs.promises.readFile(filePath, 'utf-8');

    // Target line + context window
    const lines = fileContent.split('\n');
    const targetLine = Math.max(0, sourceInfo.lineNumber - 1);
    const contextLines = lines.slice(
      Math.max(0, targetLine - 5),
      Math.min(lines.length, targetLine + 5)
    );

    // Response payload
    const response = {
      sourceInfo: {
        ...sourceInfo,
        fileContent: fileContent,
        contextLines: contextLines,
        targetLineContent: lines[targetLine] || '',
        totalLines: lines.length,
        fileExists: true
      },
      elementMetadata: {
        tagName: extractTagNameFromLine(lines[targetLine]),
        estimatedClassName: extractClassNameFromLine(lines[targetLine]),
        lineContext: getLineContext(lines, targetLine)
      },
      fileStats: {
        size: fileContent.length,
        lastModified: (await fs.promises.stat(filePath)).mtime.getTime()
      }
    };

    res.statusCode = 200;
    res.end(JSON.stringify(response));
  } catch (error) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    );
  }
}

/**
 * POST /modify-source — legacy style update.
 */
async function handleModifySource(req: any, res: any, rootDir: string) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', (chunk: any) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const { elementId, newStyles, oldStyles } = JSON.parse(body);

      if (!elementId || newStyles === undefined) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Missing required parameters' }));
        return;
      }

      // Parse elementId
      const sourceInfo = parseElementId(elementId);
      if (!sourceInfo) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Invalid elementId format' }));
        return;
      }

      const filePath = path.resolve(rootDir, sourceInfo.fileName);

      // Security: Validate path is within project root (prevent path traversal)
      if (!isPathWithinRoot(rootDir, filePath)) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: 'Access denied: path outside project root' }));
        return;
      }

      const fileContent = await fs.promises.readFile(filePath, 'utf-8');

      const updatedContent = await smartReplaceInSource(
        fileContent,
        {
          lineNumber: sourceInfo.lineNumber,
          columnNumber: sourceInfo.columnNumber,
          newValue: newStyles,
          originalValue: oldStyles || '',
          type: 'style',
        },
        rootDir,
        filePath
      );

      // Persist
      await fs.promises.writeFile(filePath, updatedContent, 'utf-8');

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: 'Source modified successfully',
          sourceInfo,
        })
      );
    } catch (error) {
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      );
    }
  });
}

/**
 * GET /health
 */
async function handleHealthCheck(res: any) {
  res.statusCode = 200;
  res.end(
    JSON.stringify({
      status: 'ok',
      timestamp: Date.now(),
      plugin: '@xagi/vite-plugin-design-mode',
    })
  );
}

/**
 * POST /update — style, content, or attribute.
 */
async function handleUpdate(req: any, res: any, rootDir: string, enableBackup: boolean = false) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', (chunk: any) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const updateData = JSON.parse(body);
      const { filePath, line, column, newValue, originalValue, type } = updateData;

      // Validate body
      if (!filePath || line === undefined || column === undefined || newValue === undefined || !type) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Missing required parameters' }));
        return;
      }

      if (!['style', 'content', 'attribute'].includes(type)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Invalid update type' }));
        return;
      }

      const fullFilePath = path.resolve(rootDir, filePath);

      try {
        await fs.promises.access(fullFilePath, fs.constants.F_OK);
      } catch {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Source file not found', filePath }));
        return;
      }

      const fileContent = await fs.promises.readFile(fullFilePath, 'utf-8');
      const lines = fileContent.split('\n');
      const targetLine = Math.max(0, line - 1);

      if (targetLine >= lines.length) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: `Line ${line} exceeds file length (${lines.length} lines)` }));
        return;
      }

      // Line-aware replace
      const updatedContent = await smartReplaceInSource(
        fileContent,
        {
          lineNumber: line,
          columnNumber: column,
          newValue,
          originalValue,
          type
        },
        rootDir,
        fullFilePath
      );

      // Optional .backup copy
      let backupPath: string | undefined;
      if (enableBackup) {
        backupPath = `${fullFilePath}.backup.${Date.now()}`;
        await fs.promises.writeFile(backupPath, fileContent, 'utf-8');
      }

      // Persist
      await fs.promises.writeFile(fullFilePath, updatedContent, 'utf-8');

      // Audit record (in-memory response)
      const updateRecord = {
        id: `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        filePath,
        line,
        column,
        type,
        newValue,
        originalValue,
        timestamp: Date.now(),
        backupPath: backupPath || null
      };

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: 'Update completed successfully',
          updateRecord,
          affectedLines: {
            before: lines[targetLine],
            after: updatedContent.split('\n')[targetLine]
          }
        })
      );
    } catch (error) {
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
          details: error instanceof Error ? error.stack : undefined
        })
      );
    }
  });
}

/**
 * POST /batch-update
 */
async function handleBatchUpdate(req: any, res: any, rootDir: string, enableBackup: boolean = false, enableHistory: boolean = false) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', (chunk: any) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const { updates } = JSON.parse(body);

      if (!Array.isArray(updates) || updates.length === 0) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'No updates provided or invalid format' }));
        return;
      }

      // Validate each item
      const validationResults = await Promise.allSettled(
        updates.map(update => validateUpdateRequest(update, rootDir))
      );

      // Batch session id
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const batchSession: {
        id: string;
        timestamp: number;
        totalUpdates: number;
        successfulUpdates: number;
        failedUpdates: number;
        updates: any[];
      } = {
        id: batchId,
        timestamp: Date.now(),
        totalUpdates: updates.length,
        successfulUpdates: 0,
        failedUpdates: 0,
        updates: []
      };

      // Apply updates sequentially
      const results = [];
      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        const validation = validationResults[i];

        if (validation.status === 'rejected') {
          results.push({
            success: false,
            error: validation.reason,
            update
          });
          batchSession.failedUpdates++;
          continue;
        }

        try {
          const result = await processSingleUpdate(update, rootDir, batchId, enableBackup);
          results.push(result);
          if (result.success) {
            batchSession.successfulUpdates++;
          } else {
            batchSession.failedUpdates++;
          }
          batchSession.updates.push(result);
        } catch (error) {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            update
          });
          batchSession.failedUpdates++;
          batchSession.updates.push(results[results.length - 1]);
        }
      }

      // Persist session JSON when history enabled
      if (enableHistory) {
        const sessionFile = path.join(rootDir, '.appdev_batch_sessions.json');
        let sessions = {};
        try {
          const existingSessionsContent = await fs.promises.readFile(sessionFile, 'utf-8');
          sessions = JSON.parse(existingSessionsContent);
        } catch {
          // Missing or unreadable → start empty
        }

        (sessions as any)[batchId] = batchSession;
        await fs.promises.writeFile(sessionFile, JSON.stringify(sessions, null, 2), 'utf-8');
      }

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          batchId,
          success: batchSession.failedUpdates === 0,
          summary: {
            total: updates.length,
            successful: batchSession.successfulUpdates,
            failed: batchSession.failedUpdates
          },
          results
        })
      );
    } catch (error) {
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      );
    }
  });
}

/**
 * GET /batch-update-status
 */
async function handleBatchUpdateStatus(req: any, res: any, rootDir: string, enableHistory: boolean = false) {
  const batchId = req.url.split('?')[1]?.split('=')[1];

  if (!batchId) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Missing batchId' }));
    return;
  }

  if (!enableHistory) {
    res.statusCode = 400;
    res.end(JSON.stringify({
      error: 'History is disabled. Cannot query batch status without history enabled.',
      enableHistory: false
    }));
    return;
  }

  try {
    const sessionFile = path.join(rootDir, '.appdev_batch_sessions.json');
    let sessions = {};

    try {
      const existingSessionsContent = await fs.promises.readFile(sessionFile, 'utf-8');
      sessions = JSON.parse(existingSessionsContent);
    } catch {
      // Session file missing
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Batch session not found' }));
      return;
    }

    const session = (sessions as any)[batchId];
    if (!session) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Batch session not found' }));
      return;
    }

    res.statusCode = 200;
    res.end(JSON.stringify({
      success: true,
      session
    }));
  } catch (error) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    );
  }
}

/**
 * POST /undo — restore from backup when backups enabled.
 */
async function handleUndo(req: any, res: any, rootDir: string, enableBackup: boolean = false) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', (chunk: any) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const { batchId } = JSON.parse(body);

      if (!batchId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Missing batchId' }));
        return;
      }

      if (!enableBackup) {
        res.statusCode = 400;
        res.end(JSON.stringify({
          error: 'Backup is disabled. Cannot undo without backup files.',
          enableBackup: false
        }));
        return;
      }

      // Find backup sidecar files
      const backupFiles = await fs.promises.readdir(rootDir);
      const matchingBackups = backupFiles
        .filter(file => file.startsWith('.') && file.includes('.backup.') && file.includes(batchId));

      if (matchingBackups.length === 0) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'No backup files found for this batch' }));
        return;
      }

      // Pick lexicographically latest (timestamp suffix)
      const latestBackup = matchingBackups.sort().pop()!;
      const backupPath = path.join(rootDir, latestBackup);
      const originalFile = backupPath.replace(/\.backup\.\d+$/, '');

      // Restore from backup
      const backupContent = await fs.promises.readFile(backupPath, 'utf-8');
      await fs.promises.writeFile(originalFile, backupContent, 'utf-8');

      await fs.promises.unlink(backupPath);

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: 'Undo completed successfully',
          restoredFile: originalFile,
          backupFile: backupPath
        })
      );
    } catch (error) {
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      );
    }
  });
}

/**
 * POST /redo — not implemented.
 */
async function handleRedo(req: any, res: any, rootDir: string) {
  // Could re-apply updates from `.appdev_batch_sessions.json`
  res.statusCode = 501;
  res.end(JSON.stringify({ error: 'Redo operation not yet implemented' }));
}

/**
 * GET /get-history
 */
async function handleGetHistory(req: any, res: any, rootDir: string, enableHistory: boolean = false) {
  if (!enableHistory) {
    res.statusCode = 400;
    res.end(JSON.stringify({
      error: 'History is disabled. Cannot get history without history enabled.',
      enableHistory: false
    }));
    return;
  }

  try {
    const sessionFile = path.join(rootDir, '.appdev_batch_sessions.json');
    let sessions = {};

    try {
      const existingSessionsContent = await fs.promises.readFile(sessionFile, 'utf-8');
      sessions = JSON.parse(existingSessionsContent);
    } catch {
      // No session file → empty history
    }

    res.statusCode = 200;
    res.end(JSON.stringify({
      success: true,
      history: sessions
    }));
  } catch (error) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    );
  }
}

/**
 * POST /validate-update
 */
async function handleValidateUpdate(req: any, res: any, rootDir: string) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', (chunk: any) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const updateData = JSON.parse(body);
      const validation = await validateUpdateRequest(updateData, rootDir);

      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        validation
      }));
    } catch (error) {
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      );
    }
  });
}

/**
 * Helpers
 */

// Parse `elementId` → file + line + column
function parseElementId(
  elementId: string
): { fileName: string; lineNumber: number; columnNumber: number } | null {
  // Support IDs shaped like "<file>:<line>:<column>_<elementType>[_<index>]".
  const match = elementId.match(/^(.*):(\d+):(\d+)_/);
  if (!match) return null;

  const fileName = match[1];
  const lineNumber = parseInt(match[2], 10);
  const columnNumber = parseInt(match[3], 10);

  if (!fileName || isNaN(lineNumber) || isNaN(columnNumber)) return null;

  return {
    fileName,
    lineNumber,
    columnNumber,
  };
}

// Line-oriented smart replace
async function smartReplaceInSource(
  content: string,
  options: {
    lineNumber: number;
    columnNumber: number;
    newValue: string;
    originalValue?: string;
    type: 'style' | 'content' | 'attribute';
  },
  rootDir: string,
  filePath?: string
): Promise<string> {
  const lines = content.split('\n');
  const targetLine = Math.max(0, options.lineNumber - 1);

  if (targetLine >= lines.length) {
    throw new Error(`Line ${options.lineNumber} exceeds file length`);
  }

  const line = lines[targetLine];
  let newLine = line;
  const isVueFile = Boolean(filePath && filePath.endsWith('.vue'));

  if (isVueFile) {
    return applyVueSfcTemplateUpdate(content, {
      lineNumber: options.lineNumber,
      columnNumber: options.columnNumber,
      newValue: options.newValue,
      originalValue: options.originalValue,
      type: options.type,
    });
  }

  try {
    switch (options.type) {
      case 'style':
        newLine = await smartReplaceStyle(line, options);
        break;
      case 'content':
        newLine = await smartReplaceContent(line, options);
        break;
      case 'attribute':
        newLine = await smartReplaceAttribute(line, options);
        break;
    }

    lines[targetLine] = newLine;
    return lines.join('\n');
  } catch (error) {
    console.error('[DesignMode] Smart replace failed:', error);
    return content; // Fallback to original content
  }
}

async function smartReplaceStyle(line: string, options: any): Promise<string> {
  const { newValue } = options;

  // 1) className="..." or className='...'
  const classNameRegex = /className=(["'])(.*?)\1/;
  if (classNameRegex.test(line)) {
    return line.replace(classNameRegex, `className=$1${newValue}$1`);
  }

  // 2) className={...} → coerce to static string (design mode output)
  const classNameExpressionRegex = /className=\{([^}]*)\}/;
  if (classNameExpressionRegex.test(line)) {
    return line.replace(classNameExpressionRegex, `className="${newValue}"`);
  }

  // 3) No className: insert after opening tag name (<Foo or <div)
  const tagMatch = line.match(/<([A-Z][a-zA-Z0-9.]*|[a-z][a-z0-9-]*)/);
  if (tagMatch) {
    const tagName = tagMatch[1];
    return line.replace(tagName, `${tagName} className="${newValue}"`);
  }

  // 4) No safe match — never replace the whole line with `newValue`
  console.warn('[DesignMode] Failed to match className or tag in line:', line);
  throw new Error('Cannot find a valid location to insert className. The component might not support styling or has complex syntax.');
}

async function smartReplaceContent(line: string, options: any): Promise<string> {
  if (options.originalValue && line.includes(options.originalValue)) {
    return line.replace(
      new RegExp(escapeRegExp(options.originalValue), 'g'),
      options.newValue
    );
  }

  // Between `>` and `<` when it matches original
  const contentMatch = line.match(/>([^<]*)</);
  if (contentMatch && contentMatch[1] === options.originalValue) {
    return line.replace(contentMatch[0], `>${options.newValue}<`);
  }

  return options.newValue;
}

async function smartReplaceAttribute(line: string, options: any): Promise<string> {
  return line.replace(
    new RegExp(`${options.attributeName}="[^"]*"`),
    `${options.attributeName}="${options.newValue}"`
  );
}

async function validateUpdateRequest(update: any, rootDir: string): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  if (!update.filePath) errors.push('Missing filePath');
  if (update.line === undefined) errors.push('Missing line');
  if (update.column === undefined) errors.push('Missing column');
  if (update.newValue === undefined) errors.push('Missing newValue');
  if (!update.type) errors.push('Missing type');

  // File must exist under root
  if (update.filePath) {
    const fullPath = path.resolve(rootDir, update.filePath);
    try {
      await fs.promises.access(fullPath, fs.constants.F_OK);
    } catch {
      errors.push(`File not found: ${update.filePath}`);
    }
  }

  // type ∈ style | content | attribute
  if (update.type && !['style', 'content', 'attribute'].includes(update.type)) {
    errors.push(`Invalid update type: ${update.type}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Single item inside batch
async function processSingleUpdate(update: any, rootDir: string, batchId: string, enableBackup: boolean = false): Promise<any> {
  try {
    const validation = await validateUpdateRequest(update, rootDir);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join(', '),
        update
      };
    }

    const fullFilePath = path.resolve(rootDir, update.filePath);
    const fileContent = await fs.promises.readFile(fullFilePath, 'utf-8');

    const updatedContent = await smartReplaceInSource(
      fileContent,
      {
        lineNumber: update.line,
        columnNumber: update.column,
        newValue: update.newValue,
        originalValue: update.originalValue,
        type: update.type
      },
      rootDir,
      fullFilePath
    );

    if (enableBackup) {
      const backupPath = `${fullFilePath}.backup.${Date.now()}`;
      await fs.promises.writeFile(backupPath, fileContent, 'utf-8');
    }

    await fs.promises.writeFile(fullFilePath, updatedContent, 'utf-8');

    return {
      success: true,
      update,
      affectedLines: {
        before: fileContent.split('\n')[update.line - 1],
        after: updatedContent.split('\n')[update.line - 1]
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      update
    };
  }
}

// Heuristic: file touched in last 5 minutes
async function checkForModifications(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(filePath);
    const lastModified = stat.mtime.getTime();
    const now = Date.now();

    return (now - lastModified) < 5 * 60 * 1000;
  } catch {
    return false;
  }
}

// Best-effort tag from a source line
function extractTagNameFromLine(line: string): string {
  const tagMatch = line.match(/<(\w+)/);
  return tagMatch ? tagMatch[1] : 'unknown';
}

// className="..." substring
function extractClassNameFromLine(line: string): string {
  const classMatch = line.match(/className\s*=\s*["']([^"']+)["']/);
  return classMatch ? classMatch[1] : '';
}

// Neighbor lines around index
function getLineContext(lines: string[], targetLine: number): { before: string; current: string; after: string } {
  return {
    before: lines[Math.max(0, targetLine - 1)] || '',
    current: lines[targetLine] || '',
    after: lines[Math.min(lines.length - 1, targetLine + 1)] || ''
  };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isPathWithinRoot(rootDir: string, targetPath: string): boolean {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(targetPath);
  const relativePath = path.relative(resolvedRoot, resolvedTarget);
  if (resolvedRoot === resolvedTarget) {
    return true;
  }
  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

