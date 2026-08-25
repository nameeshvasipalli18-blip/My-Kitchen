import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaMoon, FaSun } from 'react-icons/fa6';

const AuthShell = ({ children }) => {
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className={`auth-page${darkMode ? ' auth-dark' : ''}`}>
      <motion.header className="auth-header" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Link className="auth-logo" to="/" aria-label="Kitchen Split home">
          <span className="auth-logo-kitchen">Kitchen</span>
          <span className="auth-logo-split">Split</span>
        </Link>
        <button className="auth-theme-toggle" type="button" title={darkMode ? 'Use light mode' : 'Use dark mode'} aria-label={darkMode ? 'Use light mode' : 'Use dark mode'} aria-pressed={darkMode} onClick={() => setDarkMode((enabled) => !enabled)}>
          {darkMode ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
        </button>
      </motion.header>
      <main className="auth-content">{children}</main>
    </div>
  );
};

export default AuthShell;