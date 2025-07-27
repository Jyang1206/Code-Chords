# Expo Setup Guide for Guitar Story

## Step 1: Install Expo CLI
```bash
npm install -g @expo/cli
```

## Step 2: Create New Expo Project
```bash
# Create new Expo project
npx create-expo-app@latest guitar-story-mobile --template blank

# Navigate to new project
cd guitar-story-mobile
```

## Step 3: Install Required Dependencies

### Core Dependencies
```bash
npm install react react-dom react-native
npm install @react-navigation/native @react-navigation/stack
npm install expo-av expo-camera expo-media-library
npm install expo-sensors expo-location
npm install @expo/vector-icons
```

### Firebase for React Native
```bash
npm install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore
```

### Audio Processing
```bash
npm install expo-av expo-speech
npm install react-native-sound
```

### UI Components
```bash
npm install react-native-elements
npm install react-native-vector-icons
npm install react-native-gesture-handler
npm install react-native-reanimated
```

### Testing Dependencies
```bash
npm install --save-dev jest @testing-library/react-native
npm install --save-dev @testing-library/jest-native
```

## Step 4: Configure app.json
```json
{
  "expo": {
    "name": "Guitar Story",
    "slug": "guitar-story",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.guitarstory"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      },
      "package": "com.yourcompany.guitarstory"
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-camera",
      "expo-av",
      "expo-media-library"
    ],
    "permissions": [
      "CAMERA",
      "RECORD_AUDIO",
      "MEDIA_LIBRARY",
      "LOCATION"
    ]
  }
}
```

## Step 5: Update package.json Scripts
```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## Step 6: Install Expo Go on Your Device
- **iOS**: Download from App Store
- **Android**: Download from Google Play Store

## Step 7: Run the Project
```bash
# Start Expo development server
npm start

# Or use specific platforms
npm run ios
npm run android
npm run web
```

## Step 8: Scan QR Code
- Open Expo Go app on your device
- Scan the QR code from terminal
- App will load on your device

## Mobile-Specific Considerations

### 1. Camera and Audio Permissions
```javascript
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';

// Request permissions
const requestPermissions = async () => {
  const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
  const { status: audioStatus } = await Audio.requestPermissionsAsync();
  return cameraStatus === 'granted' && audioStatus === 'granted';
};
```

### 2. Firebase Configuration
```javascript
// firebase.config.js
import { initializeApp } from '@react-native-firebase/app';

const firebaseConfig = {
  // Your Firebase config
};

const app = initializeApp(firebaseConfig);
export default app;
```

### 3. Navigation Setup
```javascript
// App.js
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Practice" component={PracticeScreen} />
        {/* Add other screens */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

## Testing Setup for Mobile
```javascript
// jest.config.js
module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|@expo|@react-navigation)/)',
  ],
};
```

## Build for Production
```bash
# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Build for both
eas build --platform all
```

## EAS (Expo Application Services) Setup
```bash
# Install EAS CLI
npm install -g @expo/eas-cli

# Login to Expo
eas login

# Configure EAS
eas build:configure
```

This setup will give you a mobile-first application that can run on iOS, Android, and web platforms using Expo Go for development and testing. 