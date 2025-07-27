import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import Login from "../components/Login";
import Signup from "../components/Signup";
import "../css/SpaceTheme.css";
import "../css/Home.css";

function Home() {
  const { currentUser } = useAuth();
  const { theme, isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [showSignup, setShowSignup] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [showEclipse, setShowEclipse] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setScrollY(scrollPosition);
      
      // Show eclipse animation when near bottom in light mode
      if (!isDarkMode) {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollPercentage = (scrollPosition + windowHeight) / documentHeight;
        
        if (scrollPercentage > 0.8) {
          setShowEclipse(true);
        } else {
          setShowEclipse(false);
        }
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isDarkMode]);

  if (!currentUser) {
    return showSignup ? (
      <Signup onSwitch={() => setShowSignup(false)} />
    ) : (
      <Login onSwitch={() => setShowSignup(true)} />
    );
  }

  const sections = [
    {
      title: "Practice Mode",
      description: "Master your guitar skills with AI-powered practice sessions. Get real-time feedback and track your progress as you learn chords, scales, and techniques.",
      icon: "🎯",
      color: "var(--primary)",
      path: "/practice"
    },
    {
      title: "Play Along",
      description: "Play along with your favorite songs! Our AI detects your guitar playing and provides instant feedback to help you stay in rhythm.",
      icon: "🎼",
      color: "var(--secondary)",
      path: "/playalong"
    },
    {
      title: "Custom Tabs",
      description: "Create and share your own guitar tabs. Build a community of guitarists and discover new music from fellow musicians.",
      icon: "📝",
      color: "var(--accent)",
      path: "/custom-tabs"
    },
    {
      title: "Tuner",
      description: "Keep your guitar perfectly tuned with our advanced digital tuner. Supports all standard tunings and provides visual feedback.",
      icon: "🎚️",
      color: "var(--primary)",
      path: "/tuner"
    },
    {
      title: "Scoreboard",
      description: "Compete with other guitarists worldwide! Track your scores, climb the leaderboard, and challenge yourself to improve.",
      icon: "🏅",
      color: "var(--secondary)",
      path: "/scoreboard"
    },
    {
      title: "Progress Tracking",
      description: "Monitor your learning journey with detailed analytics. See your improvement over time and celebrate your achievements.",
      icon: "📈",
      color: "var(--accent)",
      path: "/scoreboard"
    }
  ];

  const handleSectionClick = (path) => {
    navigate(path);
  };

  return (
    <div className="home-container">
      {/* Hero Section */}
      <section className="hero-section space-card">
        <h1 className="glow-text hero-title">
          Guitar Story
        </h1>
        
        <h2 className="hero-subtitle">
          Your All-in-One Guitar Learning Experience
        </h2>
        
        <p className="hero-description">
          Embark on an interstellar journey of musical discovery! Code Chords combines cutting-edge AI technology 
          with traditional guitar learning methods to create the ultimate learning experience. Whether you're a 
          complete beginner or an experienced guitarist, our platform adapts to your skill level and helps you 
          reach new heights in your musical journey.
        </p>
        
        {/* Call to Action - Moved up to hero section */}
        <div className="hero-cta">
          <h2 className="glow-text cta-title">
            {currentUser ? "Welcome Back, Guitar-nomer!" : "Ready to Launch Your Musical Journey?"}
          </h2>
          
          <p className="cta-description">
            {currentUser 
              ? "Continue your interstellar guitar adventure and discover new techniques!"
              : "Join thousands of guitarists who are already exploring the universe of music with Code Chords!"
            }
          </p>
          
          {!currentUser && (
            <button className="space-button cta-button">
              Start Your Mission
            </button>
          )}
        </div>
        
        <div className="section-separator hero-separator"></div>
      </section>

      {/* Features Grid */}
      <section className="features-section">
        <div className="features-grid">
          {sections.map((section, index) => (
            <div key={index} className="space-card feature-card"
            onClick={() => handleSectionClick(section.path)}>
              <div className="feature-icon">
                {section.icon}
              </div>
              
              <h3 className="glow-text feature-title">
                {section.title}
              </h3>
              
              <p className="feature-description">
                {section.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Home; 