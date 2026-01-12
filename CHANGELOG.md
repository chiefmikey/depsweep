# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-09-12

### Added
- **Environmental Impact Analysis**: Calculate carbon savings, energy consumption, and water usage
- **Dependency Detection**: Identify unused dependencies across JavaScript, TypeScript, JSX, and TSX files
- **Protected Dependencies**: Automatically protect critical packages from removal
- **Performance Optimization**: Memory-efficient processing with concurrent file analysis
- **Structured Output**: Professional tables, progress bars, and detailed reporting
- **Advanced Configuration**: Ignore patterns, safe dependencies, and aggressive mode
- **CLI Interface**: Comprehensive command-line interface with help and version commands
- **Documentation**: Complete README with examples and usage guides

### Features
- **Dependency Analysis**
  - Support for JavaScript, TypeScript, JSX, and TSX files
  - Analysis of package.json scripts and configuration files
  - Workspace support for monorepos (Lerna, Yarn, pnpm)
  - Smart detection of various import patterns (require, import, destructuring)

- **Environmental Impact Calculation**
  - Carbon savings in kg CO2e
  - Energy savings in kWh
  - Water savings in liters
  - Tree equivalents for carbon offset
  - Car miles equivalent for CO2 savings
  - Efficiency gains and performance improvements

- **Safety Features**
  - Protected dependencies for critical packages
  - Safe dependencies flag for custom protection
  - Dry-run mode for testing before changes
  - Aggressive mode for comprehensive cleanup

- **Configuration Options**
  - Ignore patterns for directories and files
  - Safe dependencies list
  - Verbose output for debugging
  - No-progress option for cleaner output

- **Performance Features**
  - Memory optimization with LRU caching
  - Concurrent file processing
  - Smart caching of dependency analysis
  - Performance monitoring and statistics

### Technical Details
- **Language**: TypeScript with ES modules
- **Runtime**: Node.js >=18.0.0
- **Package Manager**: npm >=9.0.0
- **Dependencies**: 13 production dependencies
- **Test Coverage**: 71.5% (381 tests)
- **Build**: TypeScript compilation to dist/

### CLI Commands
```bash
# Basic usage
depsweep --measure-impact --dry-run

# Advanced configuration
depsweep --measure-impact --aggressive --safe "lodash,moment" --ignore "tests/**" --verbose

# Help and version
depsweep --help
depsweep --version
```

### Environmental Impact Examples
- **React Project (11 unused deps)**: 1.105 kg CO2e, 2.856 kWh, 5.5L water
- **Node.js Project (5 unused deps)**: 0.492 kg CO2e, 1.273 kWh, 2.4L water
- **DepSweep Project (2 unused deps)**: 1.367 kg CO2e, 3.533 kWh, 6.8L water

### Supported Project Types
- Node.js applications (Express, Koa, Fastify)
- React applications (Create React App, Next.js, Gatsby)
- Vue applications (Vue CLI, Nuxt.js)
- Angular applications (Angular CLI)
- TypeScript projects
- Monorepos (Lerna, Yarn workspaces, pnpm workspaces)

### Dependencies
- **Production**: 13 packages including Babel, Chalk, Commander, Globby
- **Development**: 8 packages including Jest, TypeScript, ESLint, Prettier

### Files Included
- `dist/` - Compiled JavaScript files
- `README.md` - Comprehensive documentation
- `LICENSE` - MIT License
- `package.json` - Package configuration

### Repository
- **GitHub**: https://github.com/yourusername/depsweep
- **Issues**: https://github.com/yourusername/depsweep/issues
- **Discussions**: https://github.com/yourusername/depsweep/discussions

---

## [0.0.0] - 2024-09-12

### Initial Development
- Project setup and initial architecture
- Core dependency analysis functionality
- Environmental impact calculation framework
- CLI interface development
- Comprehensive testing suite
- Documentation and examples

---

**DepSweep - Optimizing dependencies, reducing waste, building sustainably**
