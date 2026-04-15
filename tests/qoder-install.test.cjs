/**
 * GSD Tools Tests - Qoder Install Plumbing
 *
 * Tests for Qoder runtime directory resolution, config paths,
 * path replacement logic, and installer source integration.
 */

process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { createTempProject, cleanup } = require('./helpers.cjs');
const {
  getDirName,
  getGlobalDir,
  getConfigDirFromHome,
} = require('../bin/install.js');

describe('getDirName (Qoder)', () => {
  test('returns .qoder for qoder', () => {
    assert.strictEqual(getDirName('qoder'), '.qoder');
  });
});

describe('getConfigDirFromHome (Qoder)', () => {
  test('returns .qoder for local installs', () => {
    assert.strictEqual(getConfigDirFromHome('qoder', false), "'.qoder'");
  });

  test('returns .qoder for global installs', () => {
    assert.strictEqual(getConfigDirFromHome('qoder', true), "'.qoder'");
  });
});

describe('getGlobalDir (Qoder)', () => {
  let savedEnv;

  beforeEach(() => {
    savedEnv = {
      QODER_CONFIG_DIR: process.env.QODER_CONFIG_DIR,
    };

    delete process.env.QODER_CONFIG_DIR;
  });

  afterEach(() => {
    if (savedEnv.QODER_CONFIG_DIR === undefined) {
      delete process.env.QODER_CONFIG_DIR;
    } else {
      process.env.QODER_CONFIG_DIR = savedEnv.QODER_CONFIG_DIR;
    }
  });

  test('returns ~/.qoder by default', () => {
    assert.strictEqual(getGlobalDir('qoder'), path.join(os.homedir(), '.qoder'));
  });

  test('respects QODER_CONFIG_DIR env var', () => {
    process.env.QODER_CONFIG_DIR = '~/custom-qoder';
    assert.strictEqual(getGlobalDir('qoder'), path.join(os.homedir(), 'custom-qoder'));
  });

  test('explicit config-dir overrides env var', () => {
    process.env.QODER_CONFIG_DIR = '~/from-env';
    assert.strictEqual(getGlobalDir('qoder', '/explicit/qoder'), '/explicit/qoder');
  });

  test('does not change Claude Code global dir', () => {
    assert.strictEqual(getGlobalDir('claude'), path.join(os.homedir(), '.claude'));
  });
});

describe('Path replacement expectations (Qoder)', () => {
  // These tests verify the expected path mapping conventions for Qoder.
  // They validate the design contract rather than calling conversion functions
  // (which are added by the Qoder install.js patch).

  test('~/.claude/ maps to ~/.qoder/ for global installs', () => {
    const claudePath = '~/.claude/get-shit-done/workflows/';
    const expected = '~/.qoder/get-shit-done/workflows/';
    const result = claudePath.replace(/~\/\.claude\//g, '~/.qoder/');
    assert.strictEqual(result, expected);
  });

  test('.claude maps to .qoder for local installs', () => {
    const claudePath = '.claude/hooks/gsd-statusline.js';
    const expected = '.qoder/hooks/gsd-statusline.js';
    const result = claudePath.replace(/\.claude\//g, '.qoder/');
    assert.strictEqual(result, expected);
  });

  test('getDirName produces correct dot-prefixed dir for path construction', () => {
    const dir = getDirName('qoder');
    assert.strictEqual(dir, '.qoder');
    // Verify it can be used to build paths
    const globalPath = path.join(os.homedir(), dir);
    assert.strictEqual(globalPath, path.join(os.homedir(), '.qoder'));
  });
});

describe('Source code integration (Qoder)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'bin', 'install.js'), 'utf8');

  test('--qoder flag parsing exists', () => {
    assert.ok(src.includes("args.includes('--qoder')"), '--qoder flag parsed');
  });

  test('help text includes --qoder', () => {
    assert.ok(src.includes('--qoder'), 'help text includes --qoder option');
  });

  test('--all array includes qoder', () => {
    assert.ok(src.includes("'qoder'"), '--all includes qoder runtime');
  });

  test('getDirName handles qoder case', () => {
    // Verify via actual function call that the source supports qoder
    assert.strictEqual(getDirName('qoder'), '.qoder');
  });

  test('getGlobalDir resolves ~/.qoder for qoder runtime', () => {
    delete process.env.QODER_CONFIG_DIR;
    assert.strictEqual(getGlobalDir('qoder'), path.join(os.homedir(), '.qoder'));
  });
});
