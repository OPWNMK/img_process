/** Host half: authenticated image serving and score persistence for Five Frame. */

import { randomBytes } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DatasetError,
  RecordsError,
  browseDirectories,
  readRecords,
  removeRecord,
  saveRecord,
  scanDataset,
} from './core.js';

export const name = 'image-scorer';
export const inject = ['connection'];

const sessions = new Map();
const MAX_SESSIONS = 24;
const PLUGIN_DIR = path.dirname(fileURLToPath(import.meta.url));

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

function json(value, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function failure(message, status = 400) {
  return json({ error: message }, status);
}

function publicSession(session) {
  return {
    session_id: session.id,
    root: session.dataset.root,
    json_path: session.dataset.recordsPath,
    folders: session.dataset.folders,
    total: session.dataset.total,
    groups: session.dataset.groups.map((group) => ({
      index: group.index,
      key: group.key,
      identical_names: group.identicalNames,
      images: group.images.map((image) => ({
        folder: image.folder,
        folder_index: image.folderIndex,
        filename: image.filename,
        url: imageUrl(session.id, image),
      })),
    })),
    records: session.records,
  };
}

function imageUrl(sessionId, image) {
  const query = new URLSearchParams({
    session: sessionId,
    folder: String(image.folderIndex),
    name: image.filename,
  });
  return `/api/image-scorer.image?${query.toString()}`;
}

async function sessionOf(url) {
  const sessionId = url.searchParams.get('session') ?? '';
  const session = sessions.get(sessionId);
  if (!session) throw Object.assign(new Error('会话已失效，请重新选择文件夹。'), { status: 404 });
  return session;
}

function sessionOfPayload(payload) {
  const session = sessions.get(String(payload?.session_id ?? ''));
  if (!session) throw Object.assign(new Error('会话已失效，请重新选择文件夹。'), { status: 404 });
  return session;
}

async function loadDataset(request) {
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload.path !== 'string' || !payload.path.trim()) {
    return failure('请填写图片根文件夹路径。');
  }
  const dataset = await scanDataset(payload.path);
  const records = await readRecords(dataset.recordsPath);
  const id = randomBytes(16).toString('base64url');
  const imageLookup = new Map();
  for (const group of dataset.groups) {
    for (const image of group.images) imageLookup.set(`${image.folderIndex}\u0000${image.filename}`, path.join(dataset.root, image.folder, image.filename));
  }
  const session = { id, dataset, records, imageLookup, createdAt: Date.now() };
  sessions.set(id, session);
  while (sessions.size > MAX_SESSIONS) {
    const oldest = [...sessions.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
    if (!oldest) break;
    sessions.delete(oldest.id);
  }
  return json(publicSession(session));
}

async function browse(request) {
  const url = new URL(request.url);
  return json(await browseDirectories(url.searchParams.get('path') ?? ''));
}

async function serveImage(request) {
  const url = new URL(request.url);
  const session = await sessionOf(url);
  const folder = Number(url.searchParams.get('folder'));
  const filename = url.searchParams.get('name') ?? '';
  if (!Number.isInteger(folder) || folder < 0) return failure('图片参数无效。');
  const file = session.imageLookup.get(`${folder}\u0000${filename}`);
  if (!file) return failure('图片不存在或不属于当前数据集。', 404);

  let info;
  try {
    info = await stat(file);
    if (!info.isFile()) return failure('图片不存在。', 404);
    const bytes = await readFile(file);
    const headers = {
      'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'content-length': String(bytes.length),
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
    };
    return new Response(request.method === 'HEAD' ? null : new Uint8Array(bytes), { headers });
  } catch (error) {
    return failure(`无法读取图片：${error?.message ?? error}`, 404);
  }
}

async function record(request) {
  const payload = await request.json().catch(() => null);
  if (!payload) return failure('评分请求无法解析。');
  const session = sessionOfPayload(payload);
  const key = typeof payload.key === 'string' ? payload.key : '';
  const win = typeof payload.win === 'string' ? payload.win : '';
  const lose = typeof payload.lose === 'string' ? payload.lose : '';
  const group = session.dataset.groups.find((item) => item.key === key);
  if (!group) return failure('无法识别当前图片组，请刷新后重试。');
  const folders = new Set(session.dataset.folders.map((folder) => folder.name));
  if (!folders.has(win) || !folders.has(lose)) return failure('胜者或败者不属于当前数据集。');
  if (win === lose) return failure('胜者和败者不能是同一张图片。');
  session.records = await saveRecord(
    session.dataset.recordsPath,
    key,
    win,
    lose,
    session.dataset.groups.map((item) => item.key),
  );
  return json({ records: session.records, saved_at: Date.now() });
}

async function discard(request) {
  const payload = await request.json().catch(() => null);
  if (!payload) return failure('丢弃请求无法解析。');
  const session = sessionOfPayload(payload);
  const key = typeof payload.key === 'string' ? payload.key : '';
  if (!key.trim()) return failure('缺少记录名。');
  session.records = await removeRecord(
    session.dataset.recordsPath,
    key,
    session.dataset.groups.map((item) => item.key),
  );
  return json({ records: session.records, discarded_at: Date.now() });
}

async function environment() {
  return json({
    home: os.homedir(),
    demoPath: path.join(PLUGIN_DIR, 'demo_data'),
  });
}

function route(ctx, routePath, methods, handler) {
  return ctx.effect(
    () => ctx.connection.fetch.register({
      path: routePath,
      methods,
      requestBody: 'buffered',
      fetch: async (request) => {
        try {
          return await handler(request);
        } catch (error) {
          if (error instanceof DatasetError) return failure(error.message);
          if (error instanceof RecordsError) return failure(error.message, 409);
          if (error?.status) return failure(error.message, error.status);
          return failure(`服务器内部错误：${error?.message ?? error}`, 500);
        }
      },
    }),
    `image-scorer: ${routePath}`,
  );
}

/** Register the browser-facing routes on DSH's authenticated API channel. */
export function apply(ctx) {
  ctx.effect(() => () => { sessions.clear(); }, 'image-scorer: sessions');
  route(ctx, '/api/image-scorer.env', ['GET'], environment);
  route(ctx, '/api/image-scorer.browse', ['GET'], browse);
  route(ctx, '/api/image-scorer.load', ['POST'], loadDataset);
  route(ctx, '/api/image-scorer.image', ['GET', 'HEAD'], serveImage);
  route(ctx, '/api/image-scorer.record', ['POST'], record);
  route(ctx, '/api/image-scorer.discard', ['POST'], discard);
}
