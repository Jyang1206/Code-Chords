#!/usr/bin/env node

import fs from 'fs';

console.log('🔍 Validating package.json dependencies...');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Check for required dependencies
const requiredDeps = [
  'react',
  'react-dom',
  'react-router-dom',
  'firebase',
  'pitchy',
  'react-player',
  'react-youtube',
  'inferencejs',
  '@mediapipe/drawing_utils',
  '@mediapipe/hands',
  'roboflow',
  'axios',
  'socket.io-client'
];

// Check for required dev dependencies
const requiredDevDeps = [
  'vite',
  '@vitejs/plugin-react',
  'eslint',
  'jest',
  '@babel/preset-env',
  '@babel/preset-react',
  '@testing-library/react',
  '@testing-library/jest-dom',
  'jest-environment-jsdom'
];

console.log('\n📦 Checking production dependencies...');
let missingDeps = [];
requiredDeps.forEach(dep => {
  if (!packageJson.dependencies[dep]) {
    missingDeps.push(dep);
    console.log(`❌ Missing: ${dep}`);
  } else {
    console.log(`✅ Found: ${dep} (${packageJson.dependencies[dep]})`);
  }
});

console.log('\n🔧 Checking development dependencies...');
let missingDevDeps = [];
requiredDevDeps.forEach(dep => {
  if (!packageJson.devDependencies[dep]) {
    missingDevDeps.push(dep);
    console.log(`❌ Missing: ${dep}`);
  } else {
    console.log(`✅ Found: ${dep} (${packageJson.devDependencies[dep]})`);
  }
});

// Check for scripts
console.log('\n📜 Checking npm scripts...');
const requiredScripts = ['dev', 'build', 'preview', 'lint', 'test', 'test:watch', 'test:coverage'];
requiredScripts.forEach(script => {
  if (!packageJson.scripts[script]) {
    console.log(`❌ Missing script: ${script}`);
  } else {
    console.log(`✅ Found script: ${script}`);
  }
});

// Summary
console.log('\n📊 Summary:');
if (missingDeps.length === 0 && missingDevDeps.length === 0) {
  console.log('🎉 All dependencies are properly configured!');
  console.log('✅ New users can run "npm install" and get all required packages.');
} else {
  console.log('⚠️  Some dependencies are missing:');
  if (missingDeps.length > 0) {
    console.log(`   Production: ${missingDeps.join(', ')}`);
  }
  if (missingDevDeps.length > 0) {
    console.log(`   Development: ${missingDevDeps.join(', ')}`);
  }
}

console.log('\n💡 To install missing dependencies:');
if (missingDeps.length > 0) {
  console.log(`   npm install ${missingDeps.join(' ')}`);
}
if (missingDevDeps.length > 0) {
  console.log(`   npm install --save-dev ${missingDevDeps.join(' ')}`);
} 