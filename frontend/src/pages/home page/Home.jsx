import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaMoon, FaSun } from 'react-icons/fa6';
import { useAuth } from '../../context/AuthContext.jsx';
import './Home.css';

const Home = () => {
  const { user, isLoading } = useAuth();
  const [darkMode, setDarkMode] = useState(false);

  if (isLoading) {
    return <div className="home-container"><div className="home-content"><p className="head">Loading…</p></div></div>;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className={`home-container${darkMode ? ' home-dark' : ''}`}>
      <motion.header className="kitchen-split-header" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Link className="kitchen-split-logo" to="/" aria-label="Kitchen Split home">
          <span className="kitchen-split-logo-kitchen">Kitchen</span>
          <span className="kitchen-split-logo-split">Split</span>
        </Link>
        <div className="header-kitchen-account">
          <button className="header-theme-toggle" type="button" title={darkMode ? 'Use light mode' : 'Use dark mode'} aria-label={darkMode ? 'Use light mode' : 'Use dark mode'} aria-pressed={darkMode} onClick={() => setDarkMode((enabled) => !enabled)}>
            {darkMode ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
          </button>
        </div>
      </motion.header>
      <div className="home-content">
        <p className="head">Welcome to the Kitchen Split!</p>
        <p className="tagline">Shared kitchens, shared bills, private accounts.</p>
      </div>
      <div className="button-container">
        <Link className="split-button" to="/login">Log in</Link>
        <Link className="split-button" to="/register">Create account</Link>
      </div>
    </div>
  );
};

export default Home;
