#!/usr/bin/env node

/**
 * Coverage Analysis Script
 * Provides detailed test coverage analysis and reporting
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * Load coverage data from JSON summary
 */
function loadCoverageData() {
  const coveragePath = join(projectRoot, 'coverage', 'coverage-summary.json');

  if (!existsSync(coveragePath)) {
    console.error('❌ Coverage data not found. Run tests with coverage first.');
    console.error('   Try: npm run test:coverage');
    process.exit(1);
  }

  try {
    const coverageData = JSON.parse(readFileSync(coveragePath, 'utf8'));
    return coverageData;
  } catch (error) {
    console.error('❌ Failed to parse coverage data:', error.message);
    process.exit(1);
  }
}

/**
 * Calculate coverage percentage with color coding
 */
function formatCoverage(covered, total, threshold = 0) {
  const percentage = total > 0 ? (covered / total) * 100 : 0;
  const isAboveThreshold = percentage >= threshold;
  const color = isAboveThreshold ? '\x1b[32m' : '\x1b[31m'; // Green or Red
  const reset = '\x1b[0m';

  return `${color}${percentage.toFixed(1)}%${reset} (${covered}/${total})`;
}

/**
 * Generate detailed coverage report
 */
function generateCoverageReport(coverageData) {
  console.log('\n📊 Test Coverage Analysis Report');
  console.log('================================\n');

  const { total } = coverageData;

  if (!total) {
    console.error('❌ No coverage data available');
    return;
  }

  // Overall coverage summary
  console.log('Overall Coverage Summary:');
  console.log('-----------------------------');
  console.log(`Statements: ${formatCoverage(total.statements.covered, total.statements.total, 100)}`);
  console.log(`Branches:   ${formatCoverage(total.branches.covered, total.branches.total, 100)}`);
  console.log(`Functions:  ${formatCoverage(total.functions.covered, total.functions.total, 100)}`);
  console.log(`Lines:      ${formatCoverage(total.lines.covered, total.lines.total, 100)}`);

  // Coverage status
  const allThresholdsMet =
    (total.statements.covered / total.statements.total) >= 1.00 &&
    (total.branches.covered / total.branches.total) >= 1.00 &&
    (total.functions.covered / total.functions.total) >= 1.00 &&
    (total.lines.covered / total.lines.total) >= 1.00;

  console.log(`\nCoverage Status: ${allThresholdsMet ? 'PASSED' : 'FAILED'}`);

  // File-by-file analysis
  console.log('\nFile-by-File Coverage:');
  console.log('-------------------------');

  const files = Object.keys(coverageData).filter(key => key !== 'total');

  files.forEach(file => {
    const fileData = coverageData[file];
    const statements = fileData.statements;
    const branches = fileData.branches;
    const functions = fileData.functions;
    const lines = fileData.lines;

    const statementsPct = statements.total > 0 ? (statements.covered / statements.total) * 100 : 0;
    const branchesPct = branches.total > 0 ? (branches.covered / branches.total) * 100 : 0;
    const functionsPct = functions.total > 0 ? (functions.covered / functions.total) * 100 : 0;
    const linesPct = lines.total > 0 ? (lines.covered / lines.total) * 100 : 0;

    const avgCoverage = (statementsPct + branchesPct + functionsPct + linesPct) / 4;
    const status = avgCoverage >= 100 ? 'PASS' : 'FAIL';

    console.log(`\n${status} ${file}`);
    console.log(`   Statements: ${formatCoverage(statements.covered, statements.total, 100)}`);
    console.log(`   Branches:   ${formatCoverage(branches.covered, branches.total, 100)}`);
    console.log(`   Functions:  ${formatCoverage(functions.covered, functions.total, 100)}`);
    console.log(`   Lines:      ${formatCoverage(lines.covered, lines.total, 100)}`);
    console.log(`   Average:    ${avgCoverage.toFixed(1)}%`);
  });

  // Recommendations
  console.log('\nCoverage Recommendations:');
  console.log('-----------------------------');

  const lowCoverageFiles = files.filter(file => {
    const fileData = coverageData[file];
    const statementsPct = fileData.statements.total > 0 ? (fileData.statements.covered / fileData.statements.total) * 100 : 0;
    return statementsPct < 100;
  });

  if (lowCoverageFiles.length > 0) {
    console.log('Files needing more test coverage:');
    lowCoverageFiles.forEach(file => {
      const fileData = coverageData[file];
      const statementsPct = fileData.statements.total > 0 ? (fileData.statements.covered / fileData.statements.total) * 100 : 0;
      console.log(`   - ${file} (${statementsPct.toFixed(1)}% statements)`);
    });
  } else {
    console.log('All files meet minimum coverage requirements');
  }

  // Coverage trends (if available)
  console.log('\nCoverage Insights:');
  console.log('---------------------');

  const totalStatements = total.statements.total;
  const totalBranches = total.branches.total;
  const totalFunctions = total.functions.total;
  const totalLines = total.lines.total;

  console.log(`Total Code Metrics:`);
  console.log(`   - ${totalStatements} statements`);
  console.log(`   - ${totalBranches} branches`);
  console.log(`   - ${totalFunctions} functions`);
  console.log(`   - ${totalLines} lines`);

  const uncoveredStatements = totalStatements - total.statements.covered;
  const uncoveredBranches = totalBranches - total.branches.covered;
  const uncoveredFunctions = totalFunctions - total.functions.covered;
  const uncoveredLines = totalLines - total.lines.covered;

  console.log(`\nCoverage Gaps:`);
  console.log(`   - ${uncoveredStatements} uncovered statements`);
  console.log(`   - ${uncoveredBranches} uncovered branches`);
  console.log(`   - ${uncoveredFunctions} uncovered functions`);
  console.log(`   - ${uncoveredLines} uncovered lines`);

  console.log('\nCoverage analysis complete');

  // Exit with appropriate code
  process.exit(allThresholdsMet ? 0 : 1);
}

/**
 * Main execution
 */
function main() {
  try {
    const coverageData = loadCoverageData();
    generateCoverageReport(coverageData);
  } catch (error) {
    console.error('❌ Coverage analysis failed:', error.message);
    process.exit(1);
  }
}

// Run the analysis
main();
