# Guitar Story

## 📌 Goal
Guitar Story helps beginners overcome the challenges of learning guitar — from memorizing scale positions to mastering finger placements and navigating the fretboard. The app provides a structured and interactive self-learning experience that makes practice engaging and effective.  

---

## 💡 Motivation
- **Accessibility**: Traditional lessons are expensive and may not fit into busy schedules.  
- **Self-Learning**: Many learners prefer learning at their own pace but lack guidance.  
- **Visualization**: Guitar Story makes scales, notes, and fretboard navigation intuitive, lowering the barrier to entry for beginners.  

---

## ⚙️ Functionality
- **User Accounts**: Sign up to unlock personalized learning features.  
- **Interactive Missions**: Guided exercises that gamify guitar learning.  
- **Fretboard Navigation**: Visual aid for scales and finger placements.  
- **Progress Tracking**: Stay motivated by monitoring your improvements.  

---

## 👨‍💻 Developer Guide

### 🚀 Getting Started
```bash
# Clone the repository
git clone https://github.com/your-username/guitar-story.git
cd guitar-story

# Install dependencies
npm install

# Run the development server
npm run dev
```
# Open the app in your browser:
``` http://localhost:5173 (or whichever port) ```

### How to Use
## 1. Sign Up
  Click **Start your Mission**
  Enter your email and click **Launch Account**
## 2. Explore Missions
  Begin guided learning sessions.
## 3. Track Your Progress
  Review your scale knowledge and fretboard mastery.

### Core Features (Implemented)
- **AI-Powered Fretboard Detection**  
  - Roboflow model for fretboard detection.  
  - Real-time prediction integrated with OpenCV overlays.  
- **Dynamic Scale Overlay System**  
  - Support for at least 10 predefined scales and modes.  
  - Automatic mapping of scale positions onto the fretboard.  
- **Calibration System**  
  - Align overlays with the user’s guitar under different conditions.  
- **Interactive Feedback System**  
  - Detects wrong notes and gives visual/audio feedback.  
- **Automated Guitar Tab Processing**  
  - Parse tabs to overlay bends, slides, hammer-ons, etc.  
- **Progression System**  
  - Scoreboards, streaks, and badges to gamify learning.
- **Guitar Tuning**
  - Tune the guitar before proceeding with learning.
- **Youtube speed adjustment**
  - Follow along guitar tutorials at your own pace.
- **Play Along**
  - Gamified "Guitar Hero" visualization to play along to pre-defined songs
  - Able to visualize custom tabs uploaded
- **Custom Tab Uploads (To be improved)**
  - Create custom tabs that can be used alongside the Play Along feature
 
### Future Plans
- **Custom Tab Uploads** — improve experience and automate custom tab creation.
- **Multiplayer Mode** — play collaboratively or competitively.  
- **Mobile App Deployment** — optimized mobile version with offline ML inference.  

## 🛠 Tech Stack  
- **Frontend**: React + Vite  
- **Authentication**: Firebase (email/password, Google login)  
- **Computer Vision**: Roboflow (fretboard detection) + OpenCV + NumPy  
- **Audio Processing**: Web Audio API (tuner + real-time note detection)  
- **Storage/Sync**: Firebase Firestore (tabs, scores, leaderboards) 
