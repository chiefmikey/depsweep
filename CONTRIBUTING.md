# Contributing to DepSweep

Thank you for your interest in contributing to DepSweep! This document provides guidelines and information for contributors.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Setup](#development-setup)
4. [Contributing Guidelines](#contributing-guidelines)
5. [Pull Request Process](#pull-request-process)
6. [Coding Standards](#coding-standards)
7. [Testing](#testing)
8. [Documentation](#documentation)
9. [Release Process](#release-process)

## Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow. Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- Git
- A GitHub account

### Development Setup

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/your-username/depsweep.git
   cd depsweep
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run tests**
   ```bash
   npm test
   ```

5. **Link for local development**
   ```bash
   npm link
   ```

## Contributing Guidelines

### Types of Contributions

We welcome various types of contributions:

- **Bug fixes**: Fix issues and improve reliability
- **Feature additions**: Add new functionality
- **Documentation**: Improve guides, API docs, and examples
- **Performance improvements**: Optimize speed and memory usage
- **Testing**: Add tests and improve coverage
- **Environmental impact**: Enhance sustainability calculations

### Before Contributing

1. **Check existing issues** to see if your contribution is already being worked on
2. **Create an issue** for significant changes to discuss the approach
3. **Fork the repository** and create a feature branch
4. **Follow the coding standards** outlined below

### Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, well-documented code
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm test
   npm run test:coverage
   npm run lint
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a pull request**

## Pull Request Process

### Before Submitting

- [ ] Code follows the project's coding standards
- [ ] Tests pass and coverage is maintained
- [ ] Documentation is updated
- [ ] Changes are properly tested
- [ ] Commit messages follow conventional commits

### Pull Request Template

When creating a pull request, please include:

1. **Description**: Clear description of changes
2. **Type**: Bug fix, feature, documentation, etc.
3. **Testing**: How the changes were tested
4. **Breaking Changes**: Any breaking changes
5. **Related Issues**: Link to related issues

### Review Process

1. **Automated checks** must pass
2. **Code review** by maintainers
3. **Testing** in various environments
4. **Documentation review** if applicable
5. **Approval** from at least one maintainer

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Follow the existing code style
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Use proper type annotations

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Use semicolons
- Use trailing commas in objects and arrays
- Use meaningful variable names

### Example

```typescript
/**
 * Calculates environmental impact for dependency removal
 * @param diskSpace - Disk space in bytes
 * @param installTime - Install time in seconds
 * @returns Environmental impact metrics
 */
export function calculateEnvironmentalImpact(
  diskSpace: number,
  installTime: number
): EnvironmentalImpact {
  // Implementation
}
```

## Testing

### Test Structure

- **Unit tests**: Test individual functions and modules
- **Integration tests**: Test component interactions
- **End-to-end tests**: Test complete workflows
- **Performance tests**: Test speed and memory usage

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test files
npm test -- --testPathPatterns="unit.test.ts"

# Run tests in watch mode
npm run test:watch
```

### Writing Tests

- Write tests for all new functionality
- Aim for high test coverage
- Use descriptive test names
- Test edge cases and error conditions
- Mock external dependencies

### Example Test

```typescript
describe('calculateEnvironmentalImpact', () => {
  it('should calculate environmental impact correctly', () => {
    const diskSpace = 100; // MB
    const installTime = 30; // seconds

    const impact = calculateEnvironmentalImpact(diskSpace, installTime);

    expect(impact.carbonSavings).toBeGreaterThan(0);
    expect(impact.energySavings).toBeGreaterThan(0);
    expect(impact.waterSavings).toBeGreaterThan(0);
  });

  it('should handle zero inputs', () => {
    const impact = calculateEnvironmentalImpact(0, 0);

    expect(impact.carbonSavings).toBe(0);
    expect(impact.energySavings).toBe(0);
  });
});
```

## Documentation

### Documentation Standards

- Write clear, concise documentation
- Use proper markdown formatting
- Include code examples
- Keep documentation up to date
- Use inclusive language

### Types of Documentation

- **API Documentation**: Function and class documentation
- **User Guides**: Step-by-step instructions
- **Developer Guides**: Technical implementation details
- **README**: Project overview and quick start

### Updating Documentation

When making changes that affect documentation:

1. Update relevant documentation files
2. Add or update code examples
3. Update API references
4. Test documentation examples

## Release Process

### Versioning

We use [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps

1. **Update version** in package.json
2. **Update CHANGELOG.md** with new features and fixes
3. **Create release tag**
4. **Publish to npm**
5. **Create GitHub release**

### Changelog Format

```markdown
## [1.0.0] - 2024-01-01

### Added
- New feature description
- Another new feature

### Changed
- Changed behavior description

### Fixed
- Bug fix description

### Removed
- Removed feature description
```

## Getting Help

### Questions and Support

- **GitHub Discussions**: For questions and general discussion
- **GitHub Issues**: For bug reports and feature requests
- **Email**: For security issues (security@depsweep.dev)

### Development Resources

- **TypeScript Documentation**: [typescriptlang.org](https://www.typescriptlang.org/)
- **Jest Testing**: [jestjs.io](https://jestjs.io/)
- **Node.js Documentation**: [nodejs.org](https://nodejs.org/)

## Recognition

Contributors will be recognized in:
- **CONTRIBUTORS.md** file
- **Release notes** for significant contributions
- **GitHub contributors** page

## License

By contributing to DepSweep, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to DepSweep! Your contributions help make the project better for everyone.



