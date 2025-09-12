# Security Policy

## Supported Versions

We actively maintain security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.6.x   | :white_check_mark: |
| 0.5.x   | :white_check_mark: |
| < 0.5   | :x:                |

## Security Features

### Protected Dependencies
DepSweep includes built-in protection for critical packages to prevent accidental removal:

- **Runtime Dependencies**: Core libraries and frameworks
- **Build Tools**: Compilers, bundlers, and transpilers
- **Testing Frameworks**: Jest, Mocha, Cypress, etc.
- **Code Quality Tools**: ESLint, Prettier, TypeScript
- **Database Drivers**: MongoDB, PostgreSQL, MySQL

### Safe Mode
By default, DepSweep runs in safe mode which:
- Prevents removal of protected dependencies
- Requires explicit confirmation before removing packages
- Provides detailed analysis before making changes
- Validates package names and versions

### Security Auditing
DepSweep integrates with npm's security audit system:
- Scans for known vulnerabilities
- Reports security issues before removal
- Validates package integrity
- Checks for malicious packages

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

### 1. **DO NOT** create a public GitHub issue
### 2. Email security details to: security@depsweep.dev
### 3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline
- **Acknowledgment**: Within 24 hours
- **Initial Assessment**: Within 72 hours
- **Fix Development**: Within 7 days
- **Public Disclosure**: Within 30 days

## Security Best Practices

### For Users
1. **Always use `--dry-run` first** to preview changes
2. **Review the analysis** before confirming removal
3. **Keep DepSweep updated** to latest version
4. **Use safe mode** in production environments
5. **Audit dependencies regularly** with `npm audit`

### For Developers
1. **Validate all inputs** before processing
2. **Use secure coding practices** throughout
3. **Implement proper error handling** to prevent information leakage
4. **Follow OWASP guidelines** for security
5. **Regular security testing** and code reviews

## Security Architecture

### Input Validation
- All user inputs are validated and sanitized
- File paths are normalized and checked for traversal attacks
- Package names are validated against npm naming conventions
- Command line arguments are parsed securely

### File System Security
- Read-only access by default
- No arbitrary file writing
- Safe file path resolution
- Binary file detection and skipping

### Network Security
- HTTPS only for external requests
- No sensitive data transmission
- Secure package registry communication
- Rate limiting for API calls

### Memory Security
- Bounds checking on all memory operations
- Safe buffer handling
- Memory usage monitoring
- Garbage collection optimization

## Compliance

DepSweep is designed to meet enterprise security requirements:

- **SOC 2 Type II** compatible
- **ISO 27001** aligned
- **OWASP Top 10** compliant
- **NIST Cybersecurity Framework** compatible

## Security Updates

Security updates are released as:
- **Critical**: Immediate patch release
- **High**: Within 24 hours
- **Medium**: Within 7 days
- **Low**: Next scheduled release

## Third-Party Dependencies

We regularly audit and update all dependencies:
- Automated vulnerability scanning
- Regular dependency updates
- Security-focused dependency selection
- Minimal dependency footprint

## Security Contact

For security-related questions or concerns:
- **Email**: security@depsweep.dev
- **PGP Key**: [Available on request]
- **Response Time**: 24-48 hours

---

*This security policy is reviewed and updated quarterly.*



