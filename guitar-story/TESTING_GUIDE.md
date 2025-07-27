# Guitar Story - Testing Guide for New Users

This guide helps new users verify that all features are working correctly after installation.

## 🧪 Pre-Testing Checklist

Before starting tests, ensure:
- [ ] Node.js version 18+ installed
- [ ] All dependencies installed (`npm install`)
- [ ] `.env` file configured with Firebase and YouTube API keys
- [ ] Development server running (`npm run dev`)
- [ ] Browser permissions granted for camera and microphone

## 📋 Test Categories

### **1. Authentication & User Management**

#### **Test 1.1: Email/Password Registration**
**Steps:**
1. Navigate to the app homepage
2. Click "Sign Up" or "Create Account"
3. Enter valid email and password
4. Submit registration form

**Expected Results:**
- ✅ User account created in Firebase Auth
- ✅ User redirected to home page
- ✅ User profile data stored in Firestore
- ✅ No console errors

**Test Status:** ⏳ [ ] Pass [ ] Fail

#### **Test 1.2: Google OAuth Sign-In**
**Steps:**
1. Click "Sign in with Google" button
2. Complete Google OAuth flow
3. Verify authentication state

**Expected Results:**
- ✅ User authenticated via Google
- ✅ Profile data synced to Firestore
- ✅ User state maintained across page navigation

**Test Status:** ⏳ [ ] Pass [ ] Fail

#### **Test 1.3: User Logout**
**Steps:**
1. Sign in to the application
2. Navigate to Settings page
3. Click "Sign Out" button

**Expected Results:**
- ✅ User logged out successfully
- ✅ Redirected to home page
- ✅ Authentication state cleared

**Test Status:** ⏳ [ ] Pass [ ] Fail

### **2. Real-Time Pitch Detection**

#### **Test 2.1: Tuner Functionality**
**Steps:**
1. Navigate to Tuner page
2. Allow microphone permissions when prompted
3. Play individual guitar strings (E, A, D, G, B, E)
4. Observe pitch detection accuracy

**Expected Results:**
- ✅ Microphone access granted
- ✅ Tuner displays correct note names
- ✅ Tuning accuracy within ±10 cents
- ✅ Real-time frequency display
- ✅ No audio processing errors

**Test Status:** ⏳ [ ] Pass [ ] Fail

#### **Test 2.2: Play-Along Pitch Detection**
**Steps:**
1. Navigate to Play-Along page
2. Start a session with YouTube video
3. Play guitar notes/chords
4. Observe pitch detection overlay

**Expected Results:**
- ✅ Pitch detection responds within 100ms
- ✅ Correct note names displayed
- ✅ Detection works with chords and single notes
- ✅ No performance degradation

**Test Status:** ⏳ [ ] Pass [ ] Fail

### **3. Computer Vision & ML Detection**

#### **Test 3.1: Camera Access and Setup**
**Steps:**
1. Navigate to Practice mode
2. Click "Start Camera" or similar button
3. Grant camera permissions
4. Verify video feed displays

**Expected Results:**
- ✅ Camera permissions granted
- ✅ Video feed displays correctly
- ✅ Camera controls work (start/stop)
- ✅ No camera access errors

**Test Status:** ⏳ [ ] Pass [ ] Fail

#### **Test 3.2: ML Model Loading**
**Steps:**
1. Start camera in Practice mode
2. Wait for model loading indicator
3. Verify model loads successfully

**Expected Results:**
- ✅ Model loading indicator appears
- ✅ Model loads without errors
- ✅ Inference engine initializes
- ✅ Ready for detection

**Test Status:** ⏳ [ ] Pass [ ] Fail

#### **Test 3.3: Calibration Process**
**Steps:**
1. Click "Calibrate" button in Practice mode
2. Position guitar in frame under good lighting
3. Complete calibration process
4. Verify calibration results

**Expected Results:**
- ✅ Calibration process starts
- ✅ Progress indicators display
- ✅ Calibration completes successfully
- ✅ Filter chain saved to localStorage
- ✅ Detection accuracy improves

**Test Status:** ⏳ [ ] Pass [ ] Fail

#### **Test 3.4: Note Detection and Overlay**
**Steps:**
1. Position guitar in camera view
2. Ensure good lighting conditions
3. Observe note overlay on fretboard
4. Test different guitar positions

**Expected Results:**
- ✅ Fret positions detected
- ✅ Note overlays appear on strings
- ✅ Different note types displayed (root, scale, non-scale)
- ✅ Overlay responds to guitar movement
- ✅ Sub-100ms response time

**Test Status:** ⏳ [ ] Pass [ ] Fail

#### **Test 3.5: Tilt Correction**
**Steps:**
1. Rotate guitar up to 45 degrees
2. Observe note overlay accuracy
3. Test various angles

**Expected Results:**
- ✅ Notes remain aligned with strings
- ✅ Tilt correction applied correctly
- ✅ Overlay accuracy maintained
- ✅ No jitter or instability

**Test Status:** ⏳ [ ] Pass [ ] Fail

#### **Test 3.6: Distance-Based Scaling**
**Steps:**
1. Move guitar closer to camera
2. Move guitar farther from camera
3. Observe overlay scaling

**Expected Results:**
- ✅ Overlay scales appropriately
- ✅ Text remains readable
- ✅ Scaling clamped between 0.5x and 1.5x
- ✅ Smooth scaling transitions

**Test Status:** ⏳ [ ] Pass [ ] Fail

### **4. YouTube Integration**

#### **Test 4.1: YouTube Video Loading**
**Steps:**
1. Navigate to Practice mode
2. Enter a valid YouTube URL
3. Verify video loads and plays

**Expected Results:**
- ✅ YouTube video loads successfully
- ✅ Video controls work properly
- ✅ No loading errors
- ✅ Video quality appropriate

**Test Status:** ⏳ [ ] Pass [ ] Fail

#### **Test 4.2: YouTube Search History**
**Steps:**
1. Search for multiple YouTube videos
2. Navigate to Search History page
3. Verify search history is displayed

**Expected Results:**
- ✅ Search history shows recent searches
- ✅ Timestamps displayed correctly
- ✅ History persists across sessions
- ✅ No duplicate entries

**Test Status:** ⏳ [ ] Pass [ ] Fail

### **5. Custom Tabs Feature**

#### **Test 5.1: Tab Creation**
**Steps:**
1. Navigate to Custom Tabs page
2. Create a new tab with multiple notes
3. Save the tab

**Expected Results:**
- ✅ Tab creation interface works
- ✅ Notes can be added to tab
- ✅ Tab saves to Firestore
- ✅ Success message displayed

**Test Status:** ⏳ [ ] Pass [ ] Fail

#### **Test 5.2: Tab Retrieval**
**Steps:**
1. Create multiple custom tabs
2. Refresh the page
3. Verify tabs load correctly

**Expected Results:**
- ✅ All custom tabs displayed
- ✅ Tab data preserved correctly
- ✅ No data loss on refresh
- ✅ Loading states appropriate

**Test Status:** ⏳ [ ] Pass [ ] Fail

#### **Test 5.3: Tab Deletion**
**Steps:**
1. Select an existing custom tab
2. Click delete button
3. Confirm deletion

**Expected Results:**
- ✅ Tab deleted from Firestore
- ✅ UI updates immediately
- ✅ Confirmation dialog works
- ✅ No orphaned data

**Test Status:** ⏳ [ ] Pass [ ] Fail

### **6. Scoreboard and Leaderboard**

#### **Test 6.1: Score Submission**
**Steps:**
1. Complete a Play-Along session
2. Submit score via scoreboard
3. Verify score appears on leaderboard

**Expected Results:**
- ✅ Score submitted successfully
- ✅ Score appears on leaderboard
- ✅ User data associated correctly
- ✅ No submission errors

**Test Status:** ⏳ [ ] Pass [ ] Fail

#### **Test 6.2: Real-Time Updates**
**Steps:**
1. Open Scoreboard page
2. Have another user submit a score
3. Observe real-time update

**Expected Results:**
- ✅ New scores appear instantly
- ✅ No page refresh required
- ✅ Real-time synchronization works
- ✅ No duplicate entries

**Test Status:** ⏳ [ ] Pass [ ] Fail

### **7. Theme and UI Responsiveness**

#### **Test 7.1: Theme Switching**
**Steps:**
1. Navigate to Settings page
2. Toggle between light and dark themes
3. Verify UI updates across all pages

**Expected Results:**
- ✅ Theme switches correctly
- ✅ All components update
- ✅ Theme persists across navigation
- ✅ No visual glitches

**Test Status:** ⏳ [ ] Pass [ ] Fail

#### **Test 7.2: Responsive Design**
**Steps:**
1. Test on desktop (1920x1080)
2. Test on tablet (768x1024)
3. Test on mobile (375x667)

**Expected Results:**
- ✅ UI adapts appropriately
- ✅ All features remain accessible
- ✅ No horizontal scrolling
- ✅ Touch interactions work

**Test Status:** ⏳ [ ] Pass [ ] Fail

### **8. Performance and Error Handling**

#### **Test 8.1: Network Error Handling**
**Steps:**
1. Simulate slow network connection
2. Test Firebase operations
3. Test YouTube video loading

**Expected Results:**
- ✅ Appropriate loading states
- ✅ Error messages displayed
- ✅ App doesn't crash
- ✅ Graceful degradation

**Test Status:** ⏳ [ ] Pass [ ] Fail

#### **Test 8.2: Camera Permission Handling**
**Steps:**
1. Deny camera permissions
2. Navigate to Practice mode
3. Verify appropriate error message

**Expected Results:**
- ✅ Clear error message displayed
- ✅ App doesn't crash
- ✅ Alternative options provided
- ✅ Permission request handled

**Test Status:** ⏳ [ ] Pass [ ] Fail

#### **Test 8.3: Memory and Performance**
**Steps:**
1. Use app for extended period
2. Monitor browser memory usage
3. Test multiple features in sequence

**Expected Results:**
- ✅ No memory leaks
- ✅ Performance remains stable
- ✅ No browser crashes
- ✅ Smooth interactions

**Test Status:** ⏳ [ ] Pass [ ] Fail

### **9. Data Persistence**

#### **Test 9.1: Calibration Persistence**
**Steps:**
1. Complete calibration process
2. Close and reopen browser
3. Navigate to Practice mode

**Expected Results:**
- ✅ Calibration settings loaded
- ✅ No recalibration required
- ✅ Settings persist correctly
- ✅ No data corruption

**Test Status:** ⏳ [ ] Pass [ ] Fail

#### **Test 9.2: User Data Synchronization**
**Steps:**
1. Create data on device A
2. Sign in on device B
3. Verify data appears

**Expected Results:**
- ✅ Data syncs via Firestore
- ✅ No data loss
- ✅ Real-time updates
- ✅ Consistent state

**Test Status:** ⏳ [ ] Pass [ ] Fail

## 📊 Test Results Summary

**Total Tests:** 25
**Passed:** ___ / 25
**Failed:** ___ / 25
**Success Rate:** ___%

### **Critical Features Status:**
- [ ] Authentication System
- [ ] Real-Time Pitch Detection
- [ ] ML Object Detection
- [ ] YouTube Integration
- [ ] Custom Tabs
- [ ] Scoreboard/Leaderboard
- [ ] Theme System
- [ ] Error Handling

## 🐛 Bug Reporting

If any tests fail, please report with:
1. **Test number and name**
2. **Steps to reproduce**
3. **Expected vs actual behavior**
4. **Browser and OS information**
5. **Console errors (if any)**

## 📝 Notes

- Test in different lighting conditions
- Test with various guitar types and sizes
- Test with different internet connection speeds
- Document any performance issues or unexpected behavior
- Note any browser-specific issues

---

**Last Updated:** [Date]
**Tester:** [Name]
**Environment:** [Browser/OS/Device] 