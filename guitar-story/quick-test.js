#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

console.log('🎸 Guitar Story - Quick Test Script');
console.log('=====================================\n');

// Test 1: Check if package.json exists and has required dependencies
console.log('1. Checking package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  const requiredDeps = [
    'react', 'react-dom', 'firebase', 'pitchy', 'inferencejs',
    '@mediapipe/drawing_utils', '@mediapipe/hands'
  ];
  
  const requiredDevDeps = [
    'vite', 'jest', '@babel/preset-env', '@babel/preset-react'
  ];
  
  let missingDeps = [];
  let missingDevDeps = [];
  
  requiredDeps.forEach(dep => {
    if (!packageJson.dependencies[dep]) {
      missingDeps.push(dep);
    }
  });
  
  requiredDevDeps.forEach(dep => {
    if (!packageJson.devDependencies[dep]) {
      missingDevDeps.push(dep);
    }
  });
  
  if (missingDeps.length === 0 && missingDevDeps.length === 0) {
    console.log('✅ package.json is properly configured');
  } else {
    console.log('❌ Missing dependencies:');
    if (missingDeps.length > 0) {
      console.log(`   Production: ${missingDeps.join(', ')}`);
    }
    if (missingDevDeps.length > 0) {
      console.log(`   Development: ${missingDevDeps.join(', ')}`);
    }
  }
} catch (error) {
  console.log('❌ Error reading package.json:', error.message);
}

// Test 2: Check if required files exist
console.log('\n2. Checking required files...');
const requiredFiles = [
  'src/App.jsx',
  'src/main.jsx',
  'src/firebase.js',
  'src/utils/musicUtils.js',
  'src/components/GuitarObjDetection.jsx',
  'src/components/GuitarTuner.jsx',
  'jest.config.js',
  '.babelrc',
  'src/setupTests.js'
];

let missingFiles = [];
requiredFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    missingFiles.push(file);
  }
});

if (missingFiles.length === 0) {
  console.log('✅ All required files exist');
} else {
  console.log('❌ Missing files:');
  missingFiles.forEach(file => console.log(`   ${file}`));
}

// Test 3: Check if .env file exists
console.log('\n3. Checking environment configuration...');
if (fs.existsSync('.env')) {
  console.log('✅ .env file exists');
} else {
  console.log('⚠️  .env file not found - you may need to create one');
  console.log('   Required variables:');
  console.log('   - VITE_FIREBASE_API_KEY');
  console.log('   - VITE_FIREBASE_AUTH_DOMAIN');
  console.log('   - VITE_FIREBASE_PROJECT_ID');
  console.log('   - VITE_YOUTUBE_API_KEY');
}

// Test 4: Check if node_modules exists
console.log('\n4. Checking dependencies installation...');
if (fs.existsSync('node_modules')) {
  console.log('✅ node_modules directory exists');
} else {
  console.log('❌ node_modules not found - run "npm install"');
}

// Test 5: Check if test files exist
console.log('\n5. Checking test files...');
const testFiles = [
  'src/utils/__tests__/musicUtils.test.js',
  'src/utils/__tests__/youtubeUtils.test.js',
  'src/utils/__tests__/imagePreprocessing.test.js',
  'src/utils/__tests__/calibrationUtils.test.js'
];

let missingTests = [];
testFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    missingTests.push(file);
  }
});

if (missingTests.length === 0) {
  console.log('✅ All test files exist');
} else {
  console.log('❌ Missing test files:');
  missingTests.forEach(file => console.log(`   ${file}`));
}

// Test 6: Check Node.js version
console.log('\n6. Checking Node.js version...');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion >= 18) {
  console.log(`✅ Node.js version ${nodeVersion} is compatible`);
} else {
  console.log(`❌ Node.js version ${nodeVersion} is too old. Version 18+ required`);
}

// Summary
console.log('\n📊 Quick Test Summary');
console.log('=====================');
console.log('This script checks basic project setup.');
console.log('For comprehensive testing, see TESTING_GUIDE.md');
console.log('\nNext steps:');
console.log('1. Run "npm install" if dependencies are missing');
console.log('2. Configure .env file with API keys');
console.log('3. Run "npm run dev" to start development server');
console.log('4. Use TESTING_GUIDE.md for detailed feature testing');

console.log('\n🎸 Happy testing!'); 