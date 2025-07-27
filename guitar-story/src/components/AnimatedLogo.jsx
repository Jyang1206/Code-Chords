import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import '../css/AnimatedLogo.css';
import logoImage from '../assets/Code-Chords Logo.png';

const AnimatedLogo = ({ onAnimationComplete }) => {
  const { isDarkMode } = useTheme();
  const [currentText, setCurrentText] = useState('');
  const [textIndex, setTextIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  
  const codeLines = [
    '> launching("Guitar Story")',
    '> tuning("EADGBE")',
    '> practicing("scales")',
    '> playing("solo")',
    '> explore("guitar-verse")'
  ];

  useEffect(() => {
    const textInterval = setInterval(() => {
      if (textIndex < codeLines.length) {
        const currentLine = codeLines[textIndex];
        if (currentText.length < currentLine.length) {
          setCurrentText(currentLine.slice(0, currentText.length + 1));
        } else {
          setTimeout(() => {
            setTextIndex(textIndex + 1);
            setCurrentText('');
          }, 500);
        }
      } else {
        clearInterval(textInterval);
        setTimeout(() => {
          if (onAnimationComplete) {
            onAnimationComplete();
          }
        }, 2000);
      }
    }, 100);

    return () => clearInterval(textInterval);
  }, [currentText, textIndex, codeLines, onAnimationComplete]);

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(!showCursor);
    }, 100);

    return () => clearInterval(cursorInterval);
  }, [showCursor]);

  return (
    <div className="animated-logo-container">
    
    <div className="logo-container">
        <img 
          src={logoImage} 
          alt="Code Chords Logo" 
          className="logo-image"
        />
        <p className="logo-subtitle">Begin your musical adventure</p>
        <p className="logo-subtitle">Press any key to continue</p>
      </div>

      {/* Orbiting Notes */}
      <div className="orbiting-notes">
        <div className="note note-1">♪</div>
        <div className="note note-2">♫</div>
        <div className="note note-3">♬</div>
        <div className="note note-4">♩</div>
        <div className="note note-5">♭</div>
        <div className="note note-6">♯</div>
      </div>

      {/* Typing Animation */}
      <div className="typing-container">
        <div className="code-line">
          <span className="prompt">$</span>
          <span className="code-text">{currentText}</span>
          <span className={`cursor ${showCursor ? 'visible' : ''}`}>|</span>
        </div>
      </div>

     
    </div>
  );
};

export default AnimatedLogo; 