import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import Login from "../components/Login";
import Signup from "../components/Signup";
import "../css/SpaceTheme.css";
import "../css/Home.css";
import githubLogo from '../assets/github-mark.png';

function Home({ setShowAuthModal, setShowSignup }) {
  const { currentUser } = useAuth();
  const { theme, isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [showEclipse, setShowEclipse] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setScrollY(scrollPosition);
      
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
    if (!currentUser) {
      setShowAuthModal(true);
      setShowSignup(false);
    } else {
      navigate(path);
    }
  };

  return (
    <div className="home-container">
      <section className="hero-section space-card">
        <h1 className="glow-text hero-title">
          Guitar Story
        </h1>
    
        <h2 className="hero-subtitle">
          Your All-in-One Guitar Learning Experience
        </h2>
        
        <p className="hero-description">
          Welcome to Guitar Story! Your all-in-one guitar learning experience. 
          Whether you're a complete beginner or an experienced guitarist, you'll find a use for our platform
          that helps you reach new heights in your musical journey.
          Code Chords combines computer vision and object-detection technology with traditional guitar learning methods 
          to create the ultimate learning experience.
        </p>
        

        <div className="hero-cta"> 
          <h2 className="glow-text cta-title">
            {currentUser ? "Welcome Back!" : "Ready to begin your musical journey?"}
          </h2>
          
          <p className="cta-description">
            {currentUser 
              ? "What are you in the mood for today?"
              : "One small step for you, one giant leap for guitar learning!"
            }
          </p>
          
          {!currentUser && (
            <button
              className="space-button cta-button"
              onClick={() => { setShowAuthModal(true); setShowSignup(false); }}
            >
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
       {/* App Information */}
       <div className="features-section">
          <h2 className="glow-text feature-title">
            About Code Chords
          </h2>

          <p className="feature-description">
            Code Chords is a team of two students who are passionate about music and technology. We got the idea to utilize computer vision and object detection 
            to create a guitar learning platform that is more interactive and engaging. We've also incoporated other features that we felt were crucial to the learning experience.
            We wanted to gamify the learning experience, so we added a scoreboard and a progress tracking system as a way to not only track your progress, but also to make it more fun and engaging by competing with other users.
            We hope you enjoy using Code Chords as much as we enjoyed creating it!
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', alignItems: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            {/* GitHub Repo */}
            <a href="https://github.com/Jyang1206/Code-Chords" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.85)',
                borderRadius: '50%',
                width: 36,
                height: 36,
                boxShadow: '0 2px 8px #a3bffa33',
                marginRight: 4
              }}>
                <img src={githubLogo} alt="GitHub" style={{ width: 22, height: 22, verticalAlign: 'middle' }} />
              </span>
              <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>GitHub Repository</span>
            </a>
           
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', background: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: '0.5rem 1.2rem', boxShadow: '0 2px 8px #a3bffa33', cursor: 'pointer' }}
              onClick={() => {
                window.open('https://www.linkedin.com/in/ng-jie-yang-4928bb242', '_blank', 'noopener');
                window.open('https://www.linkedin.com/in/sean-ow-02722a251', '_blank', 'noopener');
              }}
              title="Ng Jie Yang & Sean Ow LinkedIn"
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: 24, borderRadius: '50%', background: '#a3bffa22', padding: '0.15em 0.4em', marginRight: 4 }}>🧑‍💻</span>
                <span style={{ fontWeight: 500, fontSize: '1.05rem' }}>Ng Jie Yang</span>
              </span>
              <span style={{ fontSize: 22, color: '#aaa' }}>+</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: 24, borderRadius: '50%', background: '#ffb34722', padding: '0.15em 0.4em', marginRight: 4 }}>🧑‍🎤</span>
                <span style={{ fontWeight: 500, fontSize: '1.05rem' }}>Sean Ow</span>
              </span>
            </div>
          </div>
        </div>
    </div>
  );
}

export default Home; 