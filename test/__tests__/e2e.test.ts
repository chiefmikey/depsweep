const { execSync } = require('node:child_process');
const fs = require('node:fs/promises');
const { mkdtemp, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');

describe('DepSweep CLI E2E Tests', () => {
  let testDir;
  let originalCwd;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = await mkdtemp(path.join(tmpdir(), 'depsweep-test-'));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const createTestProject = async (packageJson, files = {}) => {
    process.chdir(testDir);
    
    await writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(testDir, filePath);
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
      await writeFile(fullPath, content);
    }
  };

  const runDepSweep = (args = ['--dry-run', '--no-progress']) => {
    const cliPath = path.join(originalCwd, 'dist', 'index.js');
    try {
      const result = execSync(`node "${cliPath}" ${args.join(' ')}`, {
        encoding: 'utf8',
        timeout: 30000,
        cwd: testDir,
      });
      return result;
    } catch (error) {
      // Return error output for analysis
      return error.stdout || error.message;
    }
  };

  test('CLI should show help', () => {
    const output = runDepSweep(['--help']);
    expect(output).toContain('Usage:');
    expect(output).toContain('Options:');
    expect(output).toContain('--dry-run');
  });

  test('CLI should show version', () => {
    const output = runDepSweep(['--version']);
    expect(output).toMatch(/\d+\.\d+\.\d+/); // Should contain version number
  });

  test('should detect unused dependencies in a simple project', async () => {
    await createTestProject({
      name: 'test-project',
      dependencies: {
        'lodash': '^4.17.21', // Used
        'unused-package': '^1.0.0', // Unused
      },
    }, {
      'index.js': `
        const _ = require('lodash');
        console.log(_.isEmpty({}));
      `
    });

    const output = runDepSweep();
    
    expect(output).toContain('unused-package');
    expect(output).not.toContain('lodash');
  });

  test('should handle project with no unused dependencies', async () => {
    await createTestProject({
      name: 'test-project',
      dependencies: {
        'lodash': '^4.17.21',
      },
    }, {
      'index.js': `
        const _ = require('lodash');
        console.log(_.isEmpty({}));
      `
    });

    const output = runDepSweep();
    
    expect(output).toContain('No unused dependencies found');
  });

  test('should detect dependencies in TypeScript files', async () => {
    await createTestProject({
      name: 'test-project',
      dependencies: {
        'chalk': '^5.0.0', // Used in TS
        'unused-dep': '^1.0.0', // Unused
      },
    }, {
      'src/index.ts': `
        import chalk from 'chalk';
        console.log(chalk.blue('Hello TypeScript'));
      `
    });

    const output = runDepSweep();
    
    expect(output).toContain('unused-dep');
    expect(output).not.toContain('chalk');
  });

  test('should detect dependencies in configuration files', async () => {
    await createTestProject({
      name: 'test-project',
      dependencies: {
        'webpack': '^5.0.0', // Used in config
        'unused-dep': '^1.0.0', // Unused
      },
    }, {
      'webpack.config.js': `
        module.exports = {
          // webpack configuration
        };
      `
    });

    const output = runDepSweep();
    
    expect(output).toContain('unused-dep');
    expect(output).not.toContain('webpack');
  });

  test('should respect --safe flag', async () => {
    await createTestProject({
      name: 'test-project',
      dependencies: {
        'safe-dep': '^1.0.0',
        'unsafe-dep': '^1.0.0',
      },
    });

    const output = runDepSweep(['--safe', 'safe-dep', '--dry-run', '--no-progress']);
    
    expect(output).toContain('unsafe-dep');
    expect(output).not.toContain('safe-dep');
  });

  test('should handle empty project gracefully', async () => {
    await createTestProject({
      name: 'empty-project',
    });

    const output = runDepSweep();
    
    expect(output).toContain('No unused dependencies found');
  });

  test('should handle project with only devDependencies', async () => {
    await createTestProject({
      name: 'dev-only-project',
      devDependencies: {
        'jest': '^29.0.0', // Used in package.json script
        'unused-dev': '^1.0.0', // Unused
      },
      scripts: {
        test: 'jest'
      }
    });

    const output = runDepSweep();
    
    expect(output).toContain('unused-dev');
    expect(output).not.toContain('jest');
  });
});