/** Filesystem and JSON core for the Five Frame DSH plugin. */

import { randomBytes } from 'node:crypto';
import { readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.avif',
]);
export const FOLDER_COUNT = 5;
export const DEFAULT_RECORDS_FILENAME = 'scores.json';

export class DatasetError extends Error {}
export class RecordsError extends Error {}

export function naturalSortKey(value) {
  return String(value)
    .toLocaleLowerCase()
    .split(/(\d+)/)
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? [0, Number(part)] : [1, part]));
}

function compareNatural(a, b) {
  const left = naturalSortKey(a);
  const right = naturalSortKey(b);
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const x = left[index];
    const y = right[index];
    if (x[0] !== y[0]) return x[0] - y[0];
    if (x[1] < y[1]) return -1;
    if (x[1] > y[1]) return 1;
  }
  return left.length - right.length;
}

export function expandPath(input) {
  let value = String(input ?? '').trim();
  if (value === '~') value = os.homedir();
  else if (value.startsWith('~/') || value.startsWith('~\\')) value = path.join(os.homedir(), value.slice(2));
  return path.resolve(value);
}

async function directoryOf(input, label = '文件夹') {
  const resolved = expandPath(input);
  let info;
  try {
    info = await stat(resolved);
  } catch (error) {
    if (error?.code === 'ENOENT') throw new DatasetError(`${label}不存在：${resolved}`);
    throw new DatasetError(`无法访问${label}：${error?.message ?? error}`);
  }
  if (!info.isDirectory()) throw new DatasetError(`请选择${label}，而不是文件。`);
  return resolved;
}

async function listImages(folder) {
  let entries;
  try {
    entries = await readdir(folder, { withFileTypes: true });
  } catch (error) {
    throw new DatasetError(`无法读取子文件夹「${path.basename(folder)}」：${error?.message ?? error}`);
  }
  return entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.') && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort(compareNatural);
}

function buildGroups(folderNames, imageNames) {
  const total = imageNames[0].length;
  const usedKeys = new Set();
  const groups = [];
  for (let index = 0; index < total; index += 1) {
    const images = folderNames.map((folder, folderIndex) => {
      const filename = imageNames[folderIndex][index];
      return {
        folder,
        folderIndex,
        filename,
        stem: path.parse(filename).name,
      };
    });
    const identicalNames = new Set(images.map((image) => image.stem)).size === 1;
    const baseKey = images[0].stem.trim() || `group_${String(index + 1).padStart(4, '0')}`;
    let key = baseKey;
    let suffix = 2;
    while (usedKeys.has(key)) {
      key = `${baseKey}__${suffix}`;
      suffix += 1;
    }
    usedKeys.add(key);
    groups.push({ index, key, images, identicalNames });
  }
  return groups;
}

export async function scanDataset(rootInput, recordsFilename = DEFAULT_RECORDS_FILENAME) {
  const root = await directoryOf(rootInput, '图片根文件夹');
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    throw new DatasetError(`无法读取根文件夹：${error?.message ?? error}`);
  }
  const folders = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort(compareNatural);

  if (folders.length !== FOLDER_COUNT) {
    throw new DatasetError(
      `根目录下必须有且仅有 ${FOLDER_COUNT} 个子文件夹，当前发现 ${folders.length} 个：${folders.join('、') || '无'}`,
    );
  }

  const imageNames = [];
  for (const folder of folders) imageNames.push(await listImages(path.join(root, folder)));

  const empty = folders.filter((folder, index) => imageNames[index].length === 0);
  if (empty.length > 0) throw new DatasetError(`以下子文件夹中没有可识别的图片：${empty.join('、')}`);
  const count = imageNames[0].length;
  if (imageNames.some((names) => names.length !== count)) {
    const detail = folders.map((folder, index) => `${folder} ${imageNames[index].length} 张`).join('、');
    throw new DatasetError(`5 个子文件夹中的图片数量必须相同，当前为：${detail}`);
  }

  return {
    root,
    folders: folders.map((name, index) => ({ index, name, count })),
    groups: buildGroups(folders, imageNames),
    total: count,
    recordsPath: path.join(root, recordsFilename),
  };
}

function normalizeRecords(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new RecordsError('评分文件格式错误：最外层必须是 JSON 对象。');
  }
  const records = {};
  for (const [key, record] of Object.entries(value)) {
    if (!key.trim()) throw new RecordsError('评分文件格式错误：图片名称不能为空。');
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
      throw new RecordsError(`评分文件格式错误：「${key}」的值必须是对象。`);
    }
    if (typeof record.win !== 'string' || typeof record.lose !== 'string') {
      throw new RecordsError(`评分文件格式错误：「${key}」必须同时包含 win 和 lose 字符串。`);
    }
    records[key] = { win: record.win, lose: record.lose };
  }
  return records;
}

export async function readRecords(file) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw new RecordsError(`无法读取评分文件：${error?.message ?? error}`);
  }
  try {
    return normalizeRecords(JSON.parse(text));
  } catch (error) {
    if (error instanceof RecordsError) throw error;
    throw new RecordsError(`评分文件 ${path.basename(file)} 不是合法 JSON：${error?.message ?? error}`);
  }
}

export function orderRecords(records, preferredKeys = []) {
  const ordered = {};
  for (const key of preferredKeys) {
    if (Object.hasOwn(records, key) && !Object.hasOwn(ordered, key)) ordered[key] = records[key];
  }
  for (const key of Object.keys(records).sort(compareNatural)) {
    if (!Object.hasOwn(ordered, key)) ordered[key] = records[key];
  }
  return ordered;
}

async function atomicWrite(file, records) {
  const temp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    await writeFile(temp, `${JSON.stringify(records, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temp, file);
  } finally {
    await unlink(temp).catch(() => {});
  }
}

const queues = new Map();

async function serialized(file, task) {
  const previous = queues.get(file) ?? Promise.resolve();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const tail = previous.catch(() => {}).then(() => gate);
  queues.set(file, tail);
  await previous.catch(() => {});
  try {
    return await task();
  } finally {
    release();
    if (queues.get(file) === tail) queues.delete(file);
  }
}

export async function saveRecord(file, key, win, lose, preferredKeys = []) {
  const cleanKey = String(key ?? '').trim();
  const cleanWin = String(win ?? '').trim();
  const cleanLose = String(lose ?? '').trim();
  if (!cleanKey) throw new RecordsError('记录名不能为空。');
  if (cleanKey.length > 240) throw new RecordsError('记录名过长。');
  if (!cleanWin || !cleanLose) throw new RecordsError('胜者和败者都不能为空。');
  if (cleanWin === cleanLose) throw new RecordsError('胜者和败者不能是同一张图片。');

  return serialized(path.resolve(file), async () => {
    const records = await readRecords(file);
    records[cleanKey] = { win: cleanWin, lose: cleanLose };
    const ordered = orderRecords(records, preferredKeys);
    await atomicWrite(file, ordered);
    return ordered;
  });
}

export async function removeRecord(file, key, preferredKeys = []) {
  const cleanKey = String(key ?? '').trim();
  if (!cleanKey) throw new RecordsError('记录名不能为空。');
  return serialized(path.resolve(file), async () => {
    const records = await readRecords(file);
    if (!Object.hasOwn(records, cleanKey)) return records;
    delete records[cleanKey];
    const ordered = orderRecords(records, preferredKeys);
    await atomicWrite(file, ordered);
    return ordered;
  });
}

export async function browseDirectories(input) {
  const current = input ? await directoryOf(input, '目录') : os.homedir();
  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch (error) {
    throw new DatasetError(`无法读取该目录：${error?.message ?? error}`);
  }
  const directories = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort(compareNatural);

  const rows = [];
  for (const name of directories.slice(0, 600)) {
    const target = path.join(current, name);
    let imageCount = 0;
    let subdirCount = 0;
    try {
      const children = await readdir(target, { withFileTypes: true });
      for (const child of children) {
        if (child.name.startsWith('.')) continue;
        if (child.isDirectory()) subdirCount += 1;
        else if (child.isFile() && IMAGE_EXTENSIONS.has(path.extname(child.name).toLowerCase())) imageCount += 1;
      }
    } catch {
      // An unreadable child still appears in the list; opening it reports the error.
    }
    rows.push({ name, path: target, imageCount, subdirCount });
  }

  return {
    path: current,
    parent: path.dirname(current) === current ? null : path.dirname(current),
    entries: rows,
    truncated: directories.length > 600,
    shortcuts: [{ name: '主目录', path: os.homedir() }],
  };
}
