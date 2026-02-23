/**
 * Integration tests for OpenCode API endpoints used by the project/directory features.
 *
 * These tests run against a live OpenCode server.
 * Usage: npx tsx src/__tests__/opencode-api.test.ts [base-url]
 *
 * Default base URL: http://localhost:4096
 */

const BASE_URL = process.argv[2] || 'http://localhost:4096';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function run() {
  console.log(`\nRunning OpenCode API integration tests against ${BASE_URL}\n`);

  // --- GET /path -----------------------------------------------------------

  console.log('GET /path');

  let homePath = '';
  let cwdPath = '';

  await test('returns home and directory', async () => {
    const res = await fetch(`${BASE_URL}/path`);
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(typeof data.home === 'string' && data.home.length > 0, 'home should be a non-empty string');
    assert(typeof data.directory === 'string' && data.directory.length > 0, 'directory should be a non-empty string');
    homePath = data.home;
    cwdPath = data.directory;
  });

  // --- GET /project --------------------------------------------------------

  console.log('\nGET /project');

  await test('returns an array of projects', async () => {
    const res = await fetch(`${BASE_URL}/project`);
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), 'response should be an array');
    if (data.length > 0) {
      const p = data[0];
      assert(typeof p.id === 'string', 'project should have string id');
      assert(typeof p.worktree === 'string', 'project should have string worktree');
      assert(typeof p.time === 'object', 'project should have time object');
      assert(typeof p.time.created === 'number', 'project.time.created should be a number');
    }
  });

  // --- GET /file -----------------------------------------------------------

  console.log('\nGET /file (directory listing)');

  await test('returns 422 without path param', async () => {
    const res = await fetch(`${BASE_URL}/file?directory=${encodeURIComponent(cwdPath)}`);
    // The API requires both directory and path
    assert(!res.ok, `Expected error status, got ${res.status}`);
  });

  await test('lists files in cwd with path=.', async () => {
    const res = await fetch(
      `${BASE_URL}/file?directory=${encodeURIComponent(cwdPath)}&path=.`,
    );
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), 'response should be an array');
    assert(data.length > 0, 'cwd should have at least one entry');
    const entry = data[0];
    assert(typeof entry.name === 'string', 'entry should have string name');
    assert(typeof entry.absolute === 'string', 'entry should have string absolute');
    assert(['file', 'directory'].includes(entry.type), `entry.type should be file or directory, got ${entry.type}`);
    assert(typeof entry.ignored === 'boolean', 'entry.ignored should be boolean');
  });

  await test('contains directories when listing cwd', async () => {
    const res = await fetch(
      `${BASE_URL}/file?directory=${encodeURIComponent(cwdPath)}&path=.`,
    );
    const data = await res.json();
    const dirs = data.filter((e: any) => e.type === 'directory');
    assert(dirs.length > 0, 'cwd should contain at least one directory (e.g. src, node_modules)');
  });

  await test('lists home directory contents', async () => {
    const res = await fetch(
      `${BASE_URL}/file?directory=${encodeURIComponent(homePath)}&path=.`,
    );
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), 'response should be an array');
    assert(data.length > 0, 'home directory should have entries');
  });

  await test('absolute path works as directory param', async () => {
    const res = await fetch(
      `${BASE_URL}/file?directory=${encodeURIComponent('/')}&path=.`,
    );
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), 'response should be an array');
    assert(data.length > 0, 'root directory should have entries');
  });

  await test('directory entries have correct absolute paths', async () => {
    const res = await fetch(
      `${BASE_URL}/file?directory=${encodeURIComponent(homePath)}&path=.`,
    );
    const data = await res.json();
    const dirs = data.filter((e: any) => e.type === 'directory');
    if (dirs.length > 0) {
      const dir = dirs[0];
      assert(
        dir.absolute.startsWith(homePath),
        `absolute path "${dir.absolute}" should start with home "${homePath}"`,
      );
    }
  });

  // --- GET /find/file ------------------------------------------------------

  console.log('\nGET /find/file (directory search)');

  await test('finds directories by query', async () => {
    const res = await fetch(
      `${BASE_URL}/find/file?directory=${encodeURIComponent(cwdPath)}&query=src&type=directory&limit=10`,
    );
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), 'response should be an array');
    // src directory should exist in this project
    assert(data.length > 0, 'should find at least one result for "src"');
  });

  await test('returns strings (relative paths), not objects', async () => {
    const res = await fetch(
      `${BASE_URL}/find/file?directory=${encodeURIComponent(cwdPath)}&query=src&type=directory&limit=10`,
    );
    const data = await res.json();
    if (data.length > 0) {
      assert(typeof data[0] === 'string', `expected string results, got ${typeof data[0]}: ${JSON.stringify(data[0])}`);
    }
  });

  await test('respects limit parameter', async () => {
    const res = await fetch(
      `${BASE_URL}/find/file?directory=${encodeURIComponent(cwdPath)}&query=s&type=directory&limit=3`,
    );
    const data = await res.json();
    assert(data.length <= 3, `expected at most 3 results, got ${data.length}`);
  });

  await test('returns empty array for non-matching query', async () => {
    const res = await fetch(
      `${BASE_URL}/find/file?directory=${encodeURIComponent(cwdPath)}&query=zzz_nonexistent_xyz&type=directory&limit=10`,
    );
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), 'response should be an array');
    assert(data.length === 0, `expected 0 results, got ${data.length}`);
  });

  // --- GET /session (with directory filter) --------------------------------

  console.log('\nGET /session (directory filtering)');

  await test('returns sessions array', async () => {
    const res = await fetch(`${BASE_URL}/session`);
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), 'response should be an array');
  });

  await test('sessions have projectID and directory fields', async () => {
    const res = await fetch(`${BASE_URL}/session`);
    const data = await res.json();
    if (data.length > 0) {
      const s = data[0];
      assert('projectID' in s, 'session should have projectID field');
      assert('directory' in s, 'session should have directory field');
      assert('parentID' in s || !s.parentID, 'session may have parentID field');
    }
  });

  await test('filters sessions by directory param', async () => {
    const res = await fetch(
      `${BASE_URL}/session?directory=${encodeURIComponent(cwdPath)}`,
    );
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data), 'response should be an array');
    // All returned sessions should belong to the specified directory
    for (const s of data) {
      assert(
        s.directory === cwdPath,
        `session directory "${s.directory}" should match filter "${cwdPath}"`,
      );
    }
  });

  // --- Summary -------------------------------------------------------------

  console.log('\n' + '='.repeat(60));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Results: ${passed} passed, ${failed} failed, ${results.length} total`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  ✗ ${r.name}: ${r.error}`);
    }
    process.exit(1);
  } else {
    console.log('\nAll tests passed!');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
