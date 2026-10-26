import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  DatasetError,
  RecordsError,
  browseDirectories,
  readRecords,
  removeRecord,
  saveRecord,
  scanDataset,
} from '../core.js';

const IMAGE = Buffer.from('not-a-real-image-but-enough-for-scanner');

async function makeDataset(names = ['img10.png', 'img2.png', 'img1.png']) {
  const root = await mkdtemp(path.join(import.meta.dirname, '.tmp-'));
  for (const folder of ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']) {
    await mkdir(path.join(root, folder));
    for (const name of names) await writeFile(path.join(root, folder, name), IMAGE);
  }
  return root;
}

test('scans five folders and sorts naturally', async (t) => {
  const root = await makeDataset();
  t.after(() => rm(root, { recursive: true, force: true }));
  const dataset = await scanDataset(root);
  assert.equal(dataset.total, 3);
  assert.deepEqual(dataset.folders.map((folder) => folder.name), ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']);
  assert.deepEqual(dataset.groups[0].images.map((image) => image.filename), ['img1.png', 'img1.png', 'img1.png', 'img1.png', 'img1.png']);
  assert.deepEqual(dataset.groups[2].images.map((image) => image.filename), ['img10.png', 'img10.png', 'img10.png', 'img10.png', 'img10.png']);
  assert.equal(dataset.groups[0].key, 'img1');
  assert.equal(dataset.groups[0].identicalNames, true);
});

test('rejects wrong folder count and unequal images', async (t) => {
  const root = await mkdtemp(path.join(import.meta.dirname, '.tmp-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const folder of ['A', 'B', 'C', 'D']) await mkdir(path.join(root, folder));
  await assert.rejects(scanDataset(root), DatasetError);

  const valid = await makeDataset(['one.png', 'two.png']);
  t.after(() => rm(valid, { recursive: true, force: true }));
  await rm(path.join(valid, 'Echo', 'two.png'));
  await assert.rejects(scanDataset(valid), /数量必须相同/);
});

test('disambiguates duplicate group keys', async (t) => {
  const root = await mkdtemp(path.join(import.meta.dirname, '.tmp-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const folder of ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']) {
    await mkdir(path.join(root, folder));
    await writeFile(path.join(root, folder, 'twin.jpg'), IMAGE);
    await writeFile(path.join(root, folder, 'twin.png'), IMAGE);
  }
  const dataset = await scanDataset(root);
  assert.deepEqual(dataset.groups.map((group) => group.key), ['twin', 'twin__2']);
});

test('writes and removes records atomically', async (t) => {
  const root = await makeDataset();
  t.after(() => rm(root, { recursive: true, force: true }));
  const dataset = await scanDataset(root);
  await saveRecord(dataset.recordsPath, 'img1', 'Alpha', 'Echo', dataset.groups.map((group) => group.key));
  await saveRecord(dataset.recordsPath, 'img2', 'Bravo', 'Delta', dataset.groups.map((group) => group.key));
  const parsed = JSON.parse(await readFile(dataset.recordsPath, 'utf8'));
  assert.deepEqual(parsed, {
    img1: { win: 'Alpha', lose: 'Echo' },
    img2: { win: 'Bravo', lose: 'Delta' },
  });
  await removeRecord(dataset.recordsPath, 'img1', dataset.groups.map((group) => group.key));
  assert.deepEqual(await readRecords(dataset.recordsPath), { img2: { win: 'Bravo', lose: 'Delta' } });
  assert.equal((await readdir(root)).some((name) => name.endsWith('.tmp')), false);
});

test('rejects invalid records and same winner/loser', async (t) => {
  const root = await makeDataset();
  t.after(() => rm(root, { recursive: true, force: true }));
  const dataset = await scanDataset(root);
  await assert.rejects(saveRecord(dataset.recordsPath, 'img1', 'Alpha', 'Alpha'), RecordsError);
  await writeFile(dataset.recordsPath, '{"img1":{"win":"Alpha"}}');
  await assert.rejects(readRecords(dataset.recordsPath), /win 和 lose/);
  await writeFile(dataset.recordsPath, '{');
  await assert.rejects(readRecords(dataset.recordsPath), /不是合法 JSON/);
});

test('browses directories and reports counts', async (t) => {
  const root = await makeDataset(['a.png']);
  t.after(() => rm(root, { recursive: true, force: true }));
  const listing = await browseDirectories(root);
  assert.equal(listing.entries.length, 5);
  assert.equal(listing.entries[0].name, 'Alpha');
  assert.equal(listing.entries[0].imageCount, 1);
  assert.equal(listing.entries[0].subdirCount, 0);
  assert.equal(listing.parent, path.dirname(root));
});

test('serializes concurrent record writes', async (t) => {
  const root = await makeDataset(['a.png']);
  t.after(() => rm(root, { recursive: true, force: true }));
  const dataset = await scanDataset(root);
  await Promise.all([
    saveRecord(dataset.recordsPath, 'k1', 'Alpha', 'Echo'),
    saveRecord(dataset.recordsPath, 'k2', 'Bravo', 'Delta'),
    saveRecord(dataset.recordsPath, 'k3', 'Charlie', 'Alpha'),
  ]);
  assert.deepEqual(Object.keys(await readRecords(dataset.recordsPath)).sort(), ['k1', 'k2', 'k3']);
});
