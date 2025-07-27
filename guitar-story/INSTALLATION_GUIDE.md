# Guitar Story - Installation Guide

## 🎸 Quick Start

### For New Users

1. **Clone the repository**
   ```bash
   git clone <your-repository-url>
   cd guitar-story
   ```

2. **Run the installation script**
   
   **On macOS/Linux:**
   ```bash
   ./install.sh
   ```
   
   **On Windows:**
   ```bash
   install.bat
   ```

3. **Or install manually**
   ```bash
   npm install
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

## 📋 Prerequisites

- **Node.js** (version 18 or higher)
- **npm** (comes with Node.js)
- **Git** (for cloning)

## 🔧 Manual Installation Steps

If you prefer to install manually or the scripts don't work:

### 1. Check Node.js Version
```bash
node --version
npm --version
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Create a `.env` file in the root directory:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# YouTube API Key
VITE_YOUTUBE_API_KEY=your_youtube_api_key_here
```

### 4. Start Development Server
```bash
npm run dev
```

## 📦 What Gets Installed

When you run `npm install`, the following packages are automatically installed:

### Core Dependencies
- **React** - UI framework
- **React Router** - Client-side routing
- **Firebase** - Backend services
- **Pitchy** - Real-time pitch detection
- **MediaPipe** - Computer vision
- **InferenceJS** - Machine learning
- **Axios** - HTTP client
- **Socket.io** - Real-time communication

### Development Dependencies
- **Vite** - Build tool and dev server
- **Jest** - Testing framework
- **ESLint** - Code linting
- **Babel** - JavaScript transpilation
- **Testing Library** - Component testing

## 🧪 Testing

Run the test suite to verify everything is working:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 🔍 Validation

Run the dependency validation script to check if everything is properly configured:

```bash
node validate-deps.js
```

## 🚀 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage

## 🌐 Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

## 🔧 Troubleshooting

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

### Getting Help

1. Check the [README.md](README.md) for detailed information
2. Run `node validate-deps.js` to check dependency configuration
3. Check the console for error messages
4. Ensure all environment variables are properly set

## 📚 Next Steps

After successful installation:

1. **Configure Firebase**
   - Set up a Firebase project
   - Update the `.env` file with your Firebase credentials

2. **Configure YouTube API**
   - Get a YouTube Data API key
   - Add it to the `.env` file

3. **Test the Application**
   - Run `npm test` to verify everything works
   - Start the dev server and test all features

4. **Customize**
   - Modify components in `src/components/`
   - Add new pages in `src/Pages/`
   - Update styles in `src/css/`

## ✅ Verification Checklist

- [ ] Node.js version 18+ installed
- [ ] All dependencies installed (`npm install` completed)
- [ ] Environment variables configured (`.env` file created)
- [ ] Development server starts (`npm run dev`)
- [ ] Tests pass (`npm test`)
- [ ] Application loads in browser
- [ ] Camera/microphone permissions granted

## 🎉 Success!

Once you've completed all steps, you should have a fully functional Guitar Story application running locally. The app includes:

- Real-time pitch detection
- Computer vision for guitar detection
- YouTube video integration
- User authentication
- Custom tabs creation
- Practice tracking
- Built-in tuner

Happy coding! 🎸 