import React, { useState, useEffect } from 'react';
import AnimatedLogo from './AnimatedLogo';
import '../css/SplashScreen.css';

const SplashScreen = ({ onComplete, duration = 5000 }) => {
  const [showLogo, setShowLogo] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLogo(false);
      if (onComplete) {
        onComplete();
      }
    }, duration);

    // Handler for skipping splash
    const skipSplash = () => {
      setShowLogo(false);
      if (onComplete) onComplete();
    };
    window.addEventListener('mousedown', skipSplash);
    window.addEventListener('keydown', skipSplash);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', skipSplash);
      window.removeEventListener('keydown', skipSplash);
    };
  }, [duration, onComplete]);

  if (!showLogo) {
    return null;
  }

  return (
    <div className="splash-screen">
      <AnimatedLogo onAnimationComplete={() => {
        // The logo animation completes before the splash screen
      }} />
    </div>
  );
};

export default SplashScreen; 