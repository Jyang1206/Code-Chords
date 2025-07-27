# Guitar Story

A React-based guitar learning application with real-time pitch detection, object detection, and YouTube integration.

## Prerequisites

- **Node.js** (version 18 or higher)
- **npm** (comes with Node.js)
- **Git** (for cloning the repository)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd guitar-story
   ```

2. **Install all dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173` (or the URL shown in your terminal)

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

## Dependencies

### Core Dependencies
- **React** (^19.1.0) - UI framework
- **React DOM** (^19.1.0) - DOM rendering
- **React Router DOM** (^7.6.2) - Client-side routing
- **Firebase** (^11.9.1) - Backend services (auth, database)

### Audio & Media Processing
- **Pitchy** (^4.1.0) - Real-time pitch detection
- **React Player** (^3.0.0) - Media player component
- **React YouTube** (^10.1.0) - YouTube video integration

### Computer Vision & AI
- **InferenceJS** (^1.0.21) - Machine learning inference
- **MediaPipe** - Hand tracking and drawing utilities
  - `@mediapipe/drawing_utils` (^0.3.1675466124)
  - `@mediapipe/hands` (^0.4.1675469240)
- **Roboflow** (^0.0.2) - Computer vision API

### Network & Communication
- **Axios** (^1.10.0) - HTTP client
- **Socket.io Client** (^4.8.1) - Real-time communication

### Development Dependencies
- **Vite** (^6.3.5) - Build tool and dev server
- **ESLint** (^9.25.0) - Code linting
- **Jest** (^30.0.5) - Testing framework
- **Babel** - JavaScript transpilation
- **Testing Library** - React component testing

## Project Structure

```
guitar-story/
├── src/
│   ├── components/          # React components
│   ├── contexts/           # React contexts (auth, theme, etc.)
│   ├── Pages/             # Page components
│   ├── services/          # API and service functions
│   ├── utils/             # Utility functions
│   ├── css/               # Stylesheets
│   ├── App.jsx            # Main app component
│   └── main.jsx           # App entry point
├── public/                # Static assets
├── tests/                 # Test files
├── package.json           # Dependencies and scripts
├── vite.config.js         # Vite configuration
├── jest.config.js         # Jest configuration
└── .babelrc              # Babel configuration
```

## Features

- **Real-time Pitch Detection** - Detect guitar notes in real-time
- **Object Detection** - Computer vision for guitar detection
- **YouTube Integration** - Play along with YouTube videos
- **User Authentication** - Firebase-based auth system
- **Custom Tabs** - Create and save custom guitar tabs
- **Scoreboard** - Track practice progress
- **Tuner** - Built-in guitar tuner
- **Theme Support** - Light/dark mode

## Testing

The project includes comprehensive testing at multiple levels:

### **Quick Setup Test**
Run the quick test script to verify basic project setup:
```bash
node quick-test.js
```

### **Unit Tests**
Comprehensive unit tests for utility functions:
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### **Integration Testing**
For new users, use the comprehensive testing guide:
- **TESTING_GUIDE.md** - Complete testing checklist with 25 test scenarios
- Covers authentication, ML detection, YouTube integration, and more
- Includes performance testing and error handling scenarios

### **Test Coverage**
- **Music Utilities** - Frequency-to-note conversion, scale calculations
- **YouTube Integration** - Video ID extraction, API calls
- **Image Processing** - Canvas filters, preprocessing utilities
- **Calibration System** - Filter chain testing, calibration logic

## Environment Variables

Create a `.env` file in the root directory with your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_YOUTUBE_API_KEY=your_youtube_api_key
```

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Kill process on port 5173
   lsof -ti:5173 | xargs kill -9
   ```

2. **Node modules issues**
   ```bash
   # Clear npm cache and reinstall
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Firebase configuration errors**
   - Ensure all environment variables are set correctly
   - Check Firebase console for correct project settings

4. **Camera/microphone permissions**
   - Allow camera and microphone access in your browser
   - Check browser settings for site permissions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

[Add your license information here]
