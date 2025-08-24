# DepSweep Development Instructions

**ALWAYS** reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

DepSweep is a TypeScript CLI tool that analyzes codebases to find and remove unused dependencies. It supports npm, yarn, and pnpm package managers and works with JavaScript, TypeScript, JSX, ESM, and CommonJS projects.

## Working Effectively

### Bootstrap and Build the Repository
Run these commands in order to set up the development environment:

```bash
# Install dependencies (includes automatic build via prepare hook)
npm install  # Takes ~40 seconds. NEVER CANCEL. Set timeout to 60+ minutes.

# Build TypeScript to JavaScript (if needed separately)
npm run build  # Takes ~2 seconds

# Verify the CLI works
node dist/index.js --help
```

**CRITICAL**: The `npm install` command automatically triggers `npm run build` via the `prepare` hook, so both dependencies and build artifacts are ready after installation.

### Testing and Quality Assurance

**IMPORTANT**: The Jest test files currently exist but are empty. Running tests will fail with "Your test suite must contain at least one test." This is expected and not an error.

```bash
# Tests currently don't work (empty test files)
npm test  # WILL FAIL - tests are empty but this is expected

# Linting (has many warnings but works)
npx eslint src/ --fix  # Takes ~10 seconds. Set timeout to 15+ minutes.

# Code formatting (should pass)
npx prettier --check src/  # Takes ~1 second
```

### Running the CLI Tool

```bash
# Run on current directory
npm run start  # Builds and runs CLI

# Run directly (after building)
node dist/index.js [options]

# Common CLI usage examples
node dist/index.js --dry-run  # Preview without changes
node dist/index.js --verbose  # Show detailed analysis table
node dist/index.js --measure-impact --dry-run  # Show impact analysis
```

**TIMING EXPECTATIONS**:
- **Basic dependency analysis**: 0.4s (small projects) to 15s (large projects). NEVER CANCEL.
- **Impact analysis** (with `--measure-impact`): Add 30-60s extra. NEVER CANCEL. Set timeout to 90+ minutes.
- **Interactive mode**: Prompts for confirmation before removing dependencies.

## Validation

### Manual Testing Scenarios
ALWAYS test these scenarios after making changes to ensure functionality:

1. **Basic Analysis Test**:
   ```bash
   cd /tmp && mkdir test-proj && cd test-proj
   npm init -y
   npm install lodash react unused-package
   echo "const _ = require('lodash'); console.log(_.capitalize('test'));" > index.js
   node /path/to/depsweep/dist/index.js --dry-run
   # Should detect 'react' and 'unused-package' as unused
   ```

2. **Impact Measurement Test**:
   ```bash
   node /path/to/depsweep/dist/index.js --measure-impact --dry-run
   # Should show install time and disk space for unused packages
   ```

3. **Interactive Mode Test**:
   ```bash
   node /path/to/depsweep/dist/index.js
   # Should prompt "Do you want to remove these unused dependencies? (y/N)"
   # Answer 'n' - should respond with "No changes made"
   ```

4. **Package Manager Compatibility**:
   ```bash
   # Test with yarn
   cd /tmp && mkdir yarn-test && cd yarn-test
   npm init -y && yarn add lodash
   echo "const _ = require('lodash');" > index.js
   node /path/to/depsweep/dist/index.js --dry-run
   # Should detect no unused dependencies
   ```

### Build Validation
ALWAYS run these validation steps before committing:

```bash
# 1. Clean build
npm run build  # Takes ~2 seconds. NEVER CANCEL.

# 2. Lint check (expect warnings but should not error)
npx eslint src/ --fix  # Takes ~10 seconds. NEVER CANCEL.

# 3. Format check (should pass)
npx prettier --check src/  # Takes ~1 second

# 4. CLI functionality test
node dist/index.js --version  # Should output version number
node dist/index.js --help     # Should show help text
```

## Common Tasks

### Repository Structure
```
├── src/              # TypeScript source code
│   ├── index.ts      # Main CLI entry point
│   ├── helpers.ts    # Core analysis logic
│   ├── constants.ts  # Configuration and constants
│   ├── utils.ts      # File system utilities
│   └── interfaces.ts # Type definitions
├── dist/             # Compiled JavaScript (generated)
├── test/             # Test files (currently empty)
├── package.json      # Dependencies and scripts
└── tsconfig.json     # TypeScript configuration
```

### Important File Locations
- **Main CLI logic**: `src/index.ts` - Command-line interface and main program flow
- **Dependency analysis**: `src/helpers.ts` - Core logic for finding unused dependencies
- **File processing**: `src/utils.ts` - File system scanning and package.json handling
- **CLI constants**: `src/constants.ts` - Protected dependencies list and messages
- **Build output**: `dist/index.js` - Main executable (generated from TypeScript)

### Development Workflow
1. Make changes to TypeScript files in `src/`
2. Run `npm run build` to compile to `dist/`
3. Test CLI with `node dist/index.js [options]`
4. Run validation commands (lint, format, manual tests)
5. Commit changes

### Protected Dependencies
The tool has built-in protection for common build tools and frameworks. See `src/constants.ts` for the full list. Use `--aggressive` flag to override protection, or `--safe` to specify additional protected dependencies.

## Troubleshooting

### Tests Not Working
This is expected. The test infrastructure exists but test files are empty (`test/__tests__/unit.test.ts` and `test/__tests__/e2e.test.ts`). Jest configuration files referenced in package.json (`jest.config.e2e.ts`, `jest.config.unit.ts`) are missing.

### ESLint Warnings
The codebase has many ESLint warnings (165+ warnings). This is normal - the linting passes but reports style and safety warnings that don't prevent functionality.

### Missing Package.json Error
If CLI shows "No package.json found", ensure you're running from a directory containing a package.json file, or that the package.json is accessible in parent directories.

### CLI Hangs During Analysis
Analysis can take 15+ seconds for large projects and 30-60+ seconds with `--measure-impact`. This is normal due to file system scanning and network requests for impact measurement. NEVER CANCEL these operations.