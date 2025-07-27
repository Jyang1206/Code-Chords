# Test Automation Setup Guide

## Overview
This document provides setup instructions and examples for implementing automated testing for the guitar learning application.

## 1. Unit Testing Setup (Jest + React Testing Library)

### Installation
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jest
```

### Example Unit Tests

#### PlayAlong.test.jsx
```javascript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import PlayAlong from '../Pages/PlayAlong';

// Mock Firebase
jest.mock('../firebase', () => ({
  auth: {
    currentUser: { uid: 'test-user-id' }
  },
  db: {}
}));

// Mock AudioPitchDetector
jest.mock('../components/AudioPitchDetector', () => {
  return function MockAudioPitchDetector({ onCorrectNote, onIncorrectNote }) {
    return <div data-testid="audio-pitch-detector" />;
  };
});

const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('PlayAlong Component', () => {
  test('should render chord selection dropdown', () => {
    renderWithProviders(<PlayAlong />);
    
    expect(screen.getByText('Chords')).toBeInTheDocument();
    expect(screen.getByText('Songs')).toBeInTheDocument();
  });

  test('should display correct chord notes when chord is selected', () => {
    renderWithProviders(<PlayAlong />);
    
    // Select C Major chord
    const chordSelect = screen.getByRole('combobox');
    fireEvent.change(chordSelect, { target: { value: 'C Major' } });
    
    // Verify C Major notes are displayed
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('E')).toBeInTheDocument();
    expect(screen.getByText('G')).toBeInTheDocument();
  });

  test('should update score when correct note is played', async () => {
    renderWithProviders(<PlayAlong />);
    
    // Mock correct note detection
    const audioDetector = screen.getByTestId('audio-pitch-detector');
    
    // Simulate correct note detection
    fireEvent.click(audioDetector);
    
    await waitFor(() => {
      expect(screen.getByText(/Score:/)).toBeInTheDocument();
    });
  });
});
```

#### CustomTabs.test.jsx
```javascript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import CustomTabs from '../Pages/CustomTabs';

// Mock Firebase
jest.mock('../firebase', () => ({
  auth: {
    currentUser: { uid: 'test-user-id' }
  },
  db: {}
}));

// Mock CustomTabsService
jest.mock('../services/customTabsService', () => ({
  CustomTabsService: {
    addCustomTab: jest.fn().mockResolvedValue({ success: true, tabId: 'test-tab-id' }),
    getUserTabs: jest.fn().mockResolvedValue({ 
      success: true, 
      data: [
        { id: '1', title: 'Test Tab', notes: [] }
      ] 
    }),
    deleteCustomTab: jest.fn().mockResolvedValue({ success: true })
  }
}));

const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('CustomTabs Component', () => {
  test('should render create tab button', () => {
    renderWithProviders(<CustomTabs />);
    
    expect(screen.getByText('Create New Tab')).toBeInTheDocument();
  });

  test('should show create form when button is clicked', () => {
    renderWithProviders(<CustomTabs />);
    
    const createButton = screen.getByText('Create New Tab');
    fireEvent.click(createButton);
    
    expect(screen.getByText('Tab Information')).toBeInTheDocument();
    expect(screen.getByText('Guitar Tab Creator')).toBeInTheDocument();
  });

  test('should save tab when form is submitted', async () => {
    renderWithProviders(<CustomTabs />);
    
    // Open create form
    const createButton = screen.getByText('Create New Tab');
    fireEvent.click(createButton);
    
    // Fill form
    const titleInput = screen.getByPlaceholderText('Enter tab title');
    fireEvent.change(titleInput, { target: { value: 'Test Tab' } });
    
    // Add a note
    const fretPosition = screen.getByText('C'); // First C note on fretboard
    fireEvent.click(fretPosition);
    
    // Save tab
    const saveButton = screen.getByText('Save Tab');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Test Tab')).toBeInTheDocument();
    });
  });
});
```

## 2. Integration Testing Setup (Cypress)

### Installation
```bash
npm install --save-dev cypress
```

### cypress.config.js
```javascript
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});
```

### Example Integration Tests

#### cypress/e2e/play-along.cy.js
```javascript
describe('Play Along Feature', () => {
  beforeEach(() => {
    // Mock authentication
    cy.intercept('POST', '**/identitytoolkit.googleapis.com/**', {
      statusCode: 200,
      body: {
        localId: 'test-user-id',
        idToken: 'test-token'
      }
    }).as('auth');
    
    cy.visit('/play-along');
  });

  it('should complete full chord practice session', () => {
    // Select chord
    cy.get('[data-testid="chord-select"]').select('C Major');
    
    // Verify chord notes are displayed
    cy.get('[data-testid="chord-notes"]').should('contain', 'C');
    cy.get('[data-testid="chord-notes"]').should('contain', 'E');
    cy.get('[data-testid="chord-notes"]').should('contain', 'G');
    
    // Start practice
    cy.get('[data-testid="start-practice"]').click();
    
    // Verify practice mode is active
    cy.get('[data-testid="practice-mode"]').should('be.visible');
    
    // Verify score tracking
    cy.get('[data-testid="score-display"]').should('contain', '0');
  });

  it('should play custom tab successfully', () => {
    // Switch to songs mode
    cy.get('[data-testid="songs-mode"]').click();
    
    // Select a song
    cy.get('[data-testid="song-select"]').select('Ode to Joy - Beethoven');
    
    // Start playback
    cy.get('[data-testid="start-playback"]').click();
    
    // Verify Guitar Hero interface is active
    cy.get('[data-testid="guitar-hero-interface"]').should('be.visible');
    
    // Verify notes are traveling
    cy.get('[data-testid="traveling-notes"]').should('exist');
  });
});
```

#### cypress/e2e/custom-tabs.cy.js
```javascript
describe('Custom Tabs Feature', () => {
  beforeEach(() => {
    cy.visit('/custom-tabs');
  });

  it('should create and save custom tab', () => {
    // Open create form
    cy.get('[data-testid="create-tab-button"]').click();
    
    // Fill tab information
    cy.get('[data-testid="tab-title-input"]').type('Test Tab');
    cy.get('[data-testid="tab-artist-input"]').type('Test Artist');
    
    // Add notes using fretboard
    cy.get('[data-testid="fret-position-C"]').click(); // Click C note
    cy.get('[data-testid="add-note-button"]').click();
    
    cy.get('[data-testid="fret-position-E"]').click(); // Click E note
    cy.get('[data-testid="add-note-button"]').click();
    
    // Save tab
    cy.get('[data-testid="save-tab-button"]').click();
    
    // Verify tab is saved
    cy.get('[data-testid="tab-list"]').should('contain', 'Test Tab');
  });

  it('should delete custom tab', () => {
    // Create a tab first
    cy.get('[data-testid="create-tab-button"]').click();
    cy.get('[data-testid="tab-title-input"]').type('Tab to Delete');
    cy.get('[data-testid="save-tab-button"]').click();
    
    // Delete the tab
    cy.get('[data-testid="delete-tab-button"]').first().click();
    
    // Verify tab is removed
    cy.get('[data-testid="tab-list"]').should('not.contain', 'Tab to Delete');
  });
});
```

## 3. Performance Testing Setup (Lighthouse CI)

### Installation
```bash
npm install --save-dev @lhci/cli
```

### lighthouserc.js
```javascript
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:5173'],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

### Example Performance Test
```javascript
// performance-test.js
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

async function runPerformanceTest() {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const options = {
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['performance'],
    port: chrome.port,
  };

  const runnerResult = await lighthouse('http://localhost:5173', options);
  const reportJson = JSON.parse(runnerResult.report);

  console.log('Performance Score:', reportJson.categories.performance.score * 100);
  
  await chrome.kill();
}

runPerformanceTest();
```

## 4. API Testing Setup (Postman/Newman)

### postman_collection.json
```json
{
  "info": {
    "name": "Guitar App API Tests",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Firebase Authentication",
      "item": [
        {
          "name": "User Login",
          "request": {
            "method": "POST",
            "header": [],
            "url": {
              "raw": "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={{firebase_api_key}}",
              "host": ["identitytoolkit", "googleapis", "com"],
              "path": ["v1", "accounts:signInWithPassword"],
              "query": [
                {
                  "key": "key",
                  "value": "{{firebase_api_key}}"
                }
              ]
            },
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"{{user_email}}\",\n  \"password\": \"{{user_password}}\",\n  \"returnSecureToken\": true\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            }
          },
          "response": []
        }
      ]
    },
    {
      "name": "Firestore Operations",
      "item": [
        {
          "name": "Get User Tabs",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{auth_token}}"
              }
            ],
            "url": {
              "raw": "https://firestore.googleapis.com/v1/projects/code-chords/databases/(default)/documents/userTabs?where=userId=={{user_id}}",
              "host": ["firestore", "googleapis", "com"],
              "path": ["v1", "projects", "code-chords", "databases", "(default)", "documents", "userTabs"],
              "query": [
                {
                  "key": "where",
                  "value": "userId=={{user_id}}"
                }
              ]
            }
          },
          "response": []
        }
      ]
    }
  ]
}
```

## 5. CI/CD Pipeline Integration

### .github/workflows/test.yml
```yaml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Run unit tests
        run: npm test
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Start development server
        run: npm run dev &
      - name: Wait for server
        run: npx wait-on http://localhost:5173
      - name: Run Cypress tests
        run: npx cypress run
      - name: Upload screenshots
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: cypress-screenshots
          path: cypress/screenshots

  performance-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Start development server
        run: npm run dev &
      - name: Wait for server
        run: npx wait-on http://localhost:5173
      - name: Run Lighthouse CI
        run: npx lhci autorun
```

## 6. Test Data Management

### test-data.js
```javascript
// Test data for automated tests
export const testChords = {
  'C Major': {
    notes: ['C', 'E', 'G', 'C', 'E'],
    positions: [
      { string: 5, fret: 3, note: 'C' },
      { string: 4, fret: 2, note: 'E' },
      { string: 3, fret: 0, note: 'G' },
      { string: 2, fret: 1, note: 'C' },
      { string: 1, fret: 0, note: 'E' }
    ]
  },
  'D Major': {
    notes: ['D', 'F#', 'A', 'D'],
    positions: [
      { string: 4, fret: 0, note: 'D' },
      { string: 3, fret: 2, note: 'F#' },
      { string: 2, fret: 2, note: 'A' },
      { string: 1, fret: 2, note: 'D' }
    ]
  }
};

export const testSongs = {
  'Ode to Joy - Beethoven': {
    notes: [
      { string: 2, fret: 0, note: 'E', duration: 1 },
      { string: 2, fret: 2, note: 'F#', duration: 1 },
      { string: 2, fret: 4, note: 'G', duration: 1 }
    ]
  }
};

export const testUsers = {
  validUser: {
    email: 'test@example.com',
    password: 'testpassword123'
  },
  invalidUser: {
    email: 'invalid@example.com',
    password: 'wrongpassword'
  }
};
```

## 7. Test Reporting

### jest.config.js
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/reportWebVitals.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx}'
  ]
};
```

This setup provides a comprehensive automated testing framework for the guitar learning application, covering unit tests, integration tests, performance tests, and CI/CD integration. 