#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Helper function to create complete EnvironmentalImpact objects for testing
const createTestEnvironmentalImpactFunction = `// Helper function to create complete EnvironmentalImpact objects for testing
function createTestEnvironmentalImpact(overrides: Partial<EnvironmentalImpact> = {}): EnvironmentalImpact {
  return {
    // Primary metrics
    carbonSavings: 0,
    energySavings: 0,
    waterSavings: 0,
    treesEquivalent: 0,
    carMilesEquivalent: 0,
    efficiencyGain: 0,
    networkSavings: 0,
    storageSavings: 0,

    // Detailed energy breakdown
    transferEnergy: 0,
    cpuEnergy: 0,
    memoryEnergy: 0,
    latencyEnergy: 0,
    buildEnergy: 0,
    ciCdEnergy: 0,
    registryEnergy: 0,
    lifecycleEnergy: 0,

    // Financial impact
    carbonOffsetValue: 0,
    waterTreatmentValue: 0,
    totalFinancialValue: 0,

    // Regional variations
    carbonIntensityUsed: 0.456,
    regionalMultiplier: 1.0,

    // Time-based factors
    peakEnergySavings: 0,
    offPeakEnergySavings: 0,
    timeOfDayMultiplier: 1.0,

    // Renewable energy impact
    renewableEnergySavings: 0,
    fossilFuelSavings: 0,
    renewablePercentage: 0,

    // Additional environmental metrics
    ewasteReduction: 0,
    serverUtilizationImprovement: 0,
    developerProductivityGain: 0,
    buildTimeReduction: 0,

    // Apply overrides
    ...overrides,
  };
}`;

// Pattern to match EnvironmentalImpact object literals
const impactObjectPattern = /const\s+(\w+)\s*=\s*\{[^}]*carbonSavings[^}]*\}/gs;

// Pattern to match import statements that need EnvironmentalImpact type
const importPattern = /import\s+type\s+\{[^}]*\}\s+from\s+["']\.\.\/\.\.\/src\/interfaces\.js["']/;

// List of test files to fix
const testFiles = [
  'test/__tests__/additional-coverage.test.ts',
  'test/__tests__/coverage-completion.test.ts',
  'test/__tests__/coverage-gaps.test.ts',
  'test/__tests__/edge-cases.test.ts',
  'test/__tests__/final-coverage.test.ts',
  'test/__tests__/final-push-coverage.test.ts',
  'test/__tests__/helpers-comprehensive.test.ts',
  'test/__tests__/interfaces.test.ts',
  'test/__tests__/precision-coverage.test.ts',
  'test/__tests__/remaining-coverage.test.ts',
  'test/__tests__/unit.test.ts',
  'test/__tests__/utils-comprehensive.test.ts'
];

function fixTestFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Add EnvironmentalImpact import if not present
  if (!content.includes('EnvironmentalImpact') && content.includes('carbonSavings')) {
    // Find the last import statement
    const importMatch = content.match(/import\s+.*?from\s+["'][^"']+["'];\s*\n/g);
    if (importMatch) {
      const lastImport = importMatch[importMatch.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      const insertIndex = lastImportIndex + lastImport.length;
      
      // Add EnvironmentalImpact import
      const newImport = lastImport.includes('interfaces') 
        ? lastImport.replace('}', ', EnvironmentalImpact }')
        : `import type { EnvironmentalImpact } from "../../src/interfaces.js";\n`;
      
      if (!lastImport.includes('interfaces')) {
        content = content.slice(0, insertIndex) + newImport + content.slice(insertIndex);
        modified = true;
      }
    }
  }

  // Add helper function if not present
  if (!content.includes('createTestEnvironmentalImpact') && content.includes('carbonSavings')) {
    // Find a good place to insert the helper function (after imports, before describe)
    const describeMatch = content.match(/describe\s*\(/);
    if (describeMatch) {
      const insertIndex = describeMatch.index;
      content = content.slice(0, insertIndex) + '\n' + createTestEnvironmentalImpactFunction + '\n\n' + content.slice(insertIndex);
      modified = true;
    }
  }

  // Replace EnvironmentalImpact object literals with createTestEnvironmentalImpact calls
  content = content.replace(impactObjectPattern, (match, varName) => {
    // Extract the object properties
    const objectMatch = match.match(/\{([^}]+)\}/);
    if (objectMatch) {
      const properties = objectMatch[1];
      const overrides = properties
        .split(',')
        .map(prop => prop.trim())
        .filter(prop => prop.includes(':'))
        .map(prop => {
          const [key, value] = prop.split(':').map(s => s.trim());
          return `${key}: ${value}`;
        })
        .join(',\n          ');
      
      return `const ${varName} = createTestEnvironmentalImpact({\n          ${overrides}\n        });`;
    }
    return match;
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
  } else {
    console.log(`No changes needed: ${filePath}`);
  }
}

// Fix all test files
testFiles.forEach(fixTestFile);

console.log('Done fixing test files!');
