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

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  if (!showLogo) {
    return null;
  }

  return (
    <div className="splash-screen">
      <AnimatedLogo onAnimationComplete={() => {
        // The logo animation completes before the splash screen
        // This allows for additional timing control
      }} />
    </div>
  );
};

export default SplashScreen; 