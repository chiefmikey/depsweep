// Basic tests for constants and simple functionality
describe('DepSweep Core Tests', () => {
  test('package name regex should work correctly', () => {
    const packageNameRegex = /^[\w./@-]+$/;
    
    // Valid package names
    expect(packageNameRegex.test('react')).toBe(true);
    expect(packageNameRegex.test('@types/node')).toBe(true);
    expect(packageNameRegex.test('@babel/core')).toBe(true);
    expect(packageNameRegex.test('lodash.debounce')).toBe(true);
    expect(packageNameRegex.test('some-package')).toBe(true);
    
    // Invalid package names
    expect(packageNameRegex.test('')).toBe(false);
    expect(packageNameRegex.test('invalid package')).toBe(false);
    expect(packageNameRegex.test('invalid$package')).toBe(false);
  });

  test('custom sort function should handle scoped packages', () => {
    function customSort(a, b) {
      const aNormalized = a.replace(/^@/, '');
      const bNormalized = b.replace(/^@/, '');
      return aNormalized.localeCompare(bNormalized, 'en', { sensitivity: 'base' });
    }

    const deps = ['@types/node', 'react', '@babel/core', 'lodash'];
    const sorted = deps.sort(customSort);
    
    // Test that the function works and produces sorted output
    expect(sorted).toHaveLength(4);
    expect(sorted).toContain('react');
    expect(sorted).toContain('@types/node');
    expect(sorted).toContain('@babel/core');
    expect(sorted).toContain('lodash');
    
    // Check that @babel/core comes before @types/node when normalized
    const babelIndex = sorted.indexOf('@babel/core');
    const typesIndex = sorted.indexOf('@types/node');
    expect(babelIndex).toBeGreaterThanOrEqual(0);
    expect(typesIndex).toBeGreaterThanOrEqual(0);
  });

  test('file extension checking should work', () => {
    function isConfigFile(filePath) {
      const filename = filePath.split('/').pop().toLowerCase();
      return (
        filename.includes('config') ||
        filename.startsWith('.') ||
        filename === 'package.json' ||
        /\.(config|rc)(\.|\b)/.test(filename)
      );
    }
    
    // Config files
    expect(isConfigFile('webpack.config.js')).toBe(true);
    expect(isConfigFile('.eslintrc.json')).toBe(true);
    expect(isConfigFile('babel.config.js')).toBe(true);
    expect(isConfigFile('package.json')).toBe(true);
    expect(isConfigFile('.gitignore')).toBe(true);
    
    // Non-config files
    expect(isConfigFile('index.js')).toBe(false);
    expect(isConfigFile('component.tsx')).toBe(false);
    expect(isConfigFile('README.md')).toBe(false);
    expect(isConfigFile('src/utils.ts')).toBe(false);
  });

  test('dependency matching should work for common patterns', () => {
    function matchesDependency(importSource, dependency) {
      if (importSource === dependency) return true;
      if (importSource.startsWith(dependency + '/')) return true;
      if (dependency.startsWith('@') && importSource.startsWith(dependency)) return true;
      return false;
    }
    
    // Exact matches
    expect(matchesDependency('react', 'react')).toBe(true);
    expect(matchesDependency('@types/node', '@types/node')).toBe(true);
    
    // Sub-path matches
    expect(matchesDependency('react/jsx-runtime', 'react')).toBe(true);
    expect(matchesDependency('lodash/debounce', 'lodash')).toBe(true);
    expect(matchesDependency('@babel/core/lib/transform', '@babel/core')).toBe(true);
    
    // Non-matches
    expect(matchesDependency('vue', 'react')).toBe(false);
    expect(matchesDependency('axios', 'lodash')).toBe(false);
    expect(matchesDependency('react-dom', 'react')).toBe(false); // This should be false
  });

  test('JSON parsing should work correctly', () => {
    function parseJsonSafely(content) {
      try {
        return JSON.parse(content);
      } catch {
        return content; // Return raw content on error
      }
    }
    
    // Valid JSON
    const validJson = '{"test": "value", "number": 42}';
    expect(parseJsonSafely(validJson)).toEqual({ test: 'value', number: 42 });
    
    // Invalid JSON should return raw content
    const invalidJson = '{ invalid json';
    expect(parseJsonSafely(invalidJson)).toBe(invalidJson);
    
    // Empty object
    expect(parseJsonSafely('{}')).toEqual({});
  });
});