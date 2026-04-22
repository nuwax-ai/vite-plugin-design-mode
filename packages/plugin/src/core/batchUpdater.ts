import { IncomingMessage, ServerResponse } from 'http';
import { performUpdate, UpdateRequest } from './codeUpdater';

export interface BatchUpdateRequest {
  updates: UpdateRequest[];
}

export interface BatchUpdateResult {
  results: Array<{
    success: boolean;
    message?: string;
    filePath: string;
    type: 'style' | 'content';
  }>;
  summary: {
    total: number;
    success: number;
    failed: number;
  };
}

export async function handleBatchUpdate(req: IncomingMessage, res: ServerResponse, root: string) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  const body = await readBody(req);
  try {
    const data = JSON.parse(body) as BatchUpdateRequest;
    const { updates } = data;

    if (!Array.isArray(updates)) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Invalid request: updates must be an array' }));
      return;
    }


    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const update of updates) {
      try {
        const result = performUpdate(root, update);
        if (result.success) {
          successCount++;
        } else {
          failedCount++;
        }
        results.push({
          success: result.success,
          message: result.message,
          filePath: update.filePath,
          type: update.type
        });
      } catch (error) {
        failedCount++;
        results.push({
          success: false,
          message: String(error),
          filePath: update.filePath,
          type: update.type
        });
      }
    }

    const response: BatchUpdateResult = {
      results,
      summary: {
        total: updates.length,
        success: successCount,
        failed: failedCount
      }
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(response));

  } catch (error) {
    console.error('[appdev-design-mode] Error handling batch update:', error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(error) }));
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
