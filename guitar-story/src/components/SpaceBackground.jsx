import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import '../css/SpaceTheme.css';

const SpaceBackground = () => {
  const { theme, isDarkMode } = useTheme();
  const [stars, setStars] = useState([]);
  const [meteors, setMeteors] = useState([]);
  const [satellites, setSatellites] = useState([]);
  const [isEclipsing, setIsEclipsing] = useState(false);

  useEffect(() => {
    // Generate stars
    const generateStars = () => {
      const newStars = [];
      for (let i = 0; i < 100; i++) {
        newStars.push({
          id: i,
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          delay: Math.random() * 3
        });
      }
      setStars(newStars);
    };

    // Generate meteors
    const generateMeteors = () => {
      const newMeteors = [];
      for (let i = 0; i < 3; i++) {
        newMeteors.push({
          id: Date.now() + i,
          delay: Math.random() * 2
        });
      }
      setMeteors(newMeteors);
    };

    // Generate satellites
    const generateSatellites = () => {
      const newSatellites = [];
      for (let i = 0; i < 2; i++) {
        newSatellites.push({
          id: i,
          delay: Math.random() * 5
        });
      }
      setSatellites(newSatellites);
    };

    generateStars();
    generateMeteors();
    generateSatellites();

    const interval = setInterval(() => {
      generateMeteors();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Eclipse animation for theme switching
  useEffect(() => {
    setIsEclipsing(true);
    const timer = setTimeout(() => setIsEclipsing(false), 1000);
    return () => clearTimeout(timer);
  }, [isDarkMode]);

  return (
    <div className="space-background">
      <div className="nebula"></div>
      
      {/* Stars */}
      <div className="stars">
        {stars.map(star => (
          <div 
            key={star.id} 
            className="star" 
            style={{ 
              left: `${star.x}px`, 
              top: `${star.y}px`, 
              animationDelay: `${star.delay}s` 
            }} 
          />
        ))}
      </div>

      {/* Meteors */}
      {meteors.map(meteor => (
        <div 
          key={meteor.id} 
          className="meteor" 
          style={{ animationDelay: `${meteor.delay}s` }} 
        />
      ))}

      {/* Satellites */}
      {satellites.map(satellite => (
        <div 
          key={satellite.id} 
          className="satellite" 
          style={{ animationDelay: `${satellite.delay}s` }} 
        />
      ))}

      {/* Dark Mode: Rocket and Moon */}
      {isDarkMode && (
        <>
          <div className="rocket">
            {/* Rocket Flame */}
            <div className="rocket-flame"></div>
          </div>

          <div className="moon"></div>
        </>
      )}

      {/* Light Mode: Earth and Sun */}
      {!isDarkMode && (
        <>
          {/* Sun */}
          <div className="sun"></div>

          {/* Earth */}
          <div className="earth">
            {/* Earth's continents */}
            <div className="earth-continent"></div>
          </div>
        </>
      )}

      {/* Eclipse Animation Overlay */}
      {isEclipsing && (
        <div className="eclipse-overlay">
          {/* Moon during eclipse */}
          <div className={`eclipse-moon ${isDarkMode ? 'eclipse-in' : 'eclipse-out'}`}></div>
        </div>
      )}
    </div>
  );
};

export default SpaceBackground; 