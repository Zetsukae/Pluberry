const test = require('node:test');
const assert = require('node:assert/strict');
const { getLatestSource, mergeSourceUrls } = require('../src/main/source-sync');

test('restores the most recently saved source', () => {
  const latest = getLatestSource([
    { data: { sourceUrl: 'https://old.example/', timestamp: '2026-01-02T00:00:00Z' } },
    { data: { sourceUrl: 'https://current.example/', isCurrent: true, timestamp: '2026-01-03T00:00:00Z' } }
  ]);

  assert.equal(latest.data.sourceUrl, 'https://current.example/');
});

test('merges remote source URLs without duplicating local URLs', () => {
  const urls = mergeSourceUrls(
    ['https://local.example/'],
    [{ data: { sourceUrl: 'https://local.example/' } }, { data: { sourceUrl: 'https://remote.example/' } }]
  );

  assert.deepEqual(urls, ['https://local.example/', 'https://remote.example/']);
});