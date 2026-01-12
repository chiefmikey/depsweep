# DepSweep 🌱

**Automated intelligent dependency cleanup with environmental impact reporting**

[![npm version](https://badge.fury.io/js/depsweep.svg)](https://badge.fury.io/js/depsweep)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/depsweep)](https://nodejs.org/)
[![Test Coverage](https://img.shields.io/badge/coverage-71.5%25-green)](https://github.com/yourusername/depsweep)

DepSweep is a powerful CLI tool that intelligently identifies unused dependencies in your Node.js projects and calculates their environmental impact. It helps you clean up your codebase while making a positive impact on the environment.

## ✨ Features

- 🔍 **Smart Dependency Analysis**: Accurately identifies unused dependencies across JavaScript, TypeScript, JSX, and TSX files
- 🌱 **Environmental Impact Reporting**: Calculates carbon savings, energy consumption, and water usage
- 🛡️ **Safe Cleanup**: Protected dependencies prevent breaking changes
- ⚡ **Performance Optimized**: Fast analysis with memory optimization
- 🎯 **Flexible Configuration**: Customizable ignore patterns and safe dependencies
- 📊 **Beautiful Output**: Professional tables and progress indicators
- 🔧 **Developer Friendly**: Easy to use with comprehensive help

## 🚀 Quick Start

### Installation

```bash
npm install -g depsweep
```

### Basic Usage

```bash
# Analyze dependencies and measure environmental impact
depsweep --measure-impact --dry-run

# Run with verbose output for detailed information
depsweep --measure-impact --dry-run --verbose

# Get help
depsweep --help
```

## 📖 Usage Examples

### Basic Analysis
```bash
# Analyze current project
depsweep --measure-impact --dry-run
```

### Advanced Configuration
```bash
# Ignore specific directories
depsweep --measure-impact --ignore "tests/**,docs/**" --dry-run

# Protect specific dependencies
depsweep --measure-impact --safe "lodash,moment" --dry-run

# Aggressive cleanup (removes protected dependencies)
depsweep --measure-impact --aggressive --dry-run

# Combine multiple options
depsweep --measure-impact --aggressive --safe "express" --ignore "src/**,tests/**" --verbose
```

## 🌱 Environmental Impact

DepSweep calculates the environmental impact of removing unused dependencies:

- **🌱 Carbon Savings**: CO2 equivalent reduction
- **⚡ Energy Savings**: Reduced data center energy consumption
- **💧 Water Savings**: Reduced cooling water usage
- **🌳 Tree Equivalents**: Trees that would need to be planted to offset carbon
- **🚗 Car Miles**: Equivalent miles driven to produce the same CO2

### Example Output

```
🌱 Environmental Impact Analysis

🌍 Total Environmental Impact
┌─────────────────────────┬────────────────────┬───────────────────────────────────┐
│ Metric                  │ Value              │ Impact                            │
├─────────────────────────┼────────────────────┼───────────────────────────────────┤
│ 🌱 Carbon Savings       │ 0.492 kg CO2e      │ Equivalent to 0.02 trees/year     │
│                         │                    │ trees planted                     │
├─────────────────────────┼────────────────────┼───────────────────────────────────┤
│ ⚡ Energy Savings       │ 1.273 kWh          │ Reduced data center energy        │
│                         │                    │ consumption                       │
├─────────────────────────┼────────────────────┼───────────────────────────────────┤
│ 💧 Water Savings        │ 2.4 L              │ Reduced data center cooling needs │
├─────────────────────────┼────────────────────┼───────────────────────────────────┤
│ 🚗 Car Miles Equivalent │ 1.3 miles          │ CO2 savings equivalent to driving │
├─────────────────────────┼────────────────────┼───────────────────────────────────┤
│ 🚀 Efficiency Gain      │ 18.5%              │ Improved build and runtime        │
│                         │                    │ performance                       │
└─────────────────────────┴────────────────────┴───────────────────────────────────┘
```

## 🛡️ Safety Features

### Protected Dependencies
DepSweep automatically protects critical dependencies:
- **Runtime Dependencies**: express, react, vue, angular
- **Build Tools**: webpack, typescript, babel
- **Testing Frameworks**: jest, mocha, cypress
- **Code Quality**: eslint, prettier, husky

### Safe Dependencies
Protect specific packages from removal:
```bash
depsweep --safe "lodash,moment,axios" --measure-impact --dry-run
```

### Dry Run Mode
Always test before making changes:
```bash
depsweep --measure-impact --dry-run  # Safe - no changes made
depsweep --measure-impact            # Actually removes dependencies
```

## ⚙️ Configuration Options

| Option | Short | Description |
|--------|-------|-------------|
| `--measure-impact` | `-m` | Calculate environmental impact |
| `--dry-run` | `-d` | Run without making changes |
| `--verbose` | `-v` | Display detailed information |
| `--aggressive` | `-a` | Allow removal of protected dependencies |
| `--safe <deps>` | `-s` | Dependencies that will not be removed |
| `--ignore <paths>` | `-i` | Patterns to ignore during scanning |
| `--no-progress` | `-n` | Disable progress bar |
| `--version` | | Display version information |
| `--help` | `-h` | Display help information |

## 🔧 Advanced Usage

### Ignore Patterns
```bash
# Ignore multiple directories
depsweep --ignore "src/**,tests/**,docs/**" --measure-impact --dry-run

# Ignore specific file types
depsweep --ignore "*.test.js,*.spec.js" --measure-impact --dry-run
```

### Workspace Support
DepSweep automatically detects and analyzes:
- Monorepos with workspaces
- Lerna projects
- Yarn workspaces
- pnpm workspaces

### Performance Optimization
- **Memory Efficient**: Uses optimized caching and memory management
- **Concurrent Processing**: Parallel file analysis for faster results
- **Smart Caching**: Caches dependency analysis results

## 📊 Supported Project Types

- **Node.js**: Express, Koa, Fastify applications
- **React**: Create React App, Next.js, Gatsby
- **Vue**: Vue CLI, Nuxt.js
- **Angular**: Angular CLI applications
- **TypeScript**: Pure TypeScript projects
- **Monorepos**: Lerna, Yarn workspaces, pnpm workspaces

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit
npm run test:e2e
```

## 📈 Performance

DepSweep is optimized for performance:
- **Memory Usage**: 25-44MB for large projects
- **Processing Speed**: 1-2 seconds for complex projects
- **Concurrent Operations**: Parallel file processing
- **Smart Caching**: Reduces redundant operations

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/depsweep.git
cd depsweep

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Link for local development
npm link
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by the need for sustainable software development
- Built with environmental consciousness in mind
- Thanks to all contributors and the open-source community

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/depsweep/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/depsweep/discussions)
- **Documentation**: [GitHub Wiki](https://github.com/yourusername/depsweep/wiki)

---

**Make your codebase cleaner and the environment greener! 🌱✨**

Made with ❤️ and 🌱 for a sustainable future.
