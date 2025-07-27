import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  const theme = {
    isDarkMode,
    colors: isDarkMode ? {
      // Dark mode - Space theme
      primary: '#FFD700', // Bright yellow
      secondary: '#4A90E2', // Blue
      accent: '#9B59B6', // Purple
      background: '#0A0A0F', // Deep black
      surface: '#1A1A2E', // Dark blue
      text: '#FFFFFF',
      textSecondary: '#B0B0B0',
      border: '#FFD700',
      glow: '#FFD700',
      stars: '#FFFFFF',
      nebula: 'rgba(74, 144, 226, 0.3)',
      meteor: '#FF6B35',
      satellite: '#E8E8E8',
      rocket: '#FFD700',
      moon: '#C0C0C0'
    } : {
      // Light mode - Nebula theme
      primary: '#6C5CE7', // Purple
      secondary: '#4A90E2', // Blue
      accent: '#00B894', // Green
      background: '#F8F9FF', // Light white
      surface: '#FFFFFF',
      text: '#2D3436',
      textSecondary: '#636E72',
      border: '#6C5CE7',
      glow: '#6C5CE7',
      stars: '#FFD700',
      nebula: 'rgba(108, 92, 231, 0.1)',
      meteor: '#FF6B35',
      satellite: '#2D3436',
      rocket: '#6C5CE7',
      moon: '#F1F2F6'
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext; 