import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import '../css/SpaceTheme.css';

// Import the space assets
import sunAsset from '../assets/Coding Sunburst Design.png';
import earthAsset from '../assets/Earth design.png';
import moonAsset from '../assets/Pastel Moon with HTML Bracket.png';
import rocketAsset from '../assets/Rocket.png';

const SpaceBackground = () => {
  const { theme, isDarkMode } = useTheme();
  const [stars, setStars] = useState([]);
  const [meteors, setMeteors] = useState([]);
  const [satellites, setSatellites] = useState([]);
  const [isEclipsing, setIsEclipsing] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  // Handle scroll events
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  // Calculate scroll-based positions
  const getScrollBasedPosition = (baseX, baseY, scrollMultiplier = 0.5) => {
    const scrollOffset = scrollY * scrollMultiplier;
    return {
      x: baseX,
      y: baseY - scrollOffset
    };
  };

  // Get positions for different elements based on scroll
  const rocketPosition = getScrollBasedPosition(50, window.innerHeight - 150, 0.3);
  const earthPosition = getScrollBasedPosition(window.innerWidth - 120, 100, 0.4);
  const sunPosition = getScrollBasedPosition(window.innerWidth - 150, 50, 0.2);
  const moonPosition = getScrollBasedPosition(window.innerWidth - 120, window.innerHeight - 120, 0.25);

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
          <div 
            className="rocket-asset"
            style={{
              position: 'absolute',
              left: `${rocketPosition.x}px`,
              top: `${rocketPosition.y}px`,
              width: '80px',
              height: '120px',
              zIndex: 5,
              transition: 'all 0.3s ease'
            }}
          >
            <img 
              src={rocketAsset} 
              alt="Rocket" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 20px rgba(255, 179, 71, 0.8))'
              }}
            />
          </div>

          <div 
            className="moon-asset"
            style={{
              position: 'absolute',
              left: `${moonPosition.x}px`,
              top: `${moonPosition.y}px`,
              width: '100px',
              height: '100px',
              zIndex: 1,
              transition: 'all 0.3s ease'
            }}
          >
            <img 
              src={moonAsset} 
              alt="Moon" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 30px rgba(192, 192, 192, 0.8))'
              }}
            />
          </div>
        </>
      )}

      {/* Light Mode: Earth and Sun */}
      {!isDarkMode && (
        <>
          {/* Sun */}
          <div 
            className="sun-asset"
            style={{
              position: 'absolute',
              left: `${sunPosition.x}px`,
              top: `${sunPosition.y}px`,
              width: '120px',
              height: '120px',
              zIndex: 2,
              transition: 'all 0.3s ease'
            }}
          >
            <img 
              src={sunAsset} 
              alt="Sun" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 40px rgba(255, 215, 0, 0.8))'
              }}
            />
          </div>

          {/* Earth */}
          <div 
            className="earth-asset"
            style={{
              position: 'absolute',
              left: `${earthPosition.x}px`,
              top: `${earthPosition.y}px`,
              width: '80px',
              height: '80px',
              zIndex: 3,
              transition: 'all 0.3s ease'
            }}
          >
            <img 
              src={earthAsset} 
              alt="Earth" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 20px rgba(74, 144, 226, 0.8))'
              }}
            />
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