import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FaChevronDown, FaCircleUser, FaMoon, FaSun } from 'react-icons/fa6';
import api from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout, loadUser } = useAuth();
  const [kitchens, setKitchens] = useState([]);
  const [kitchenName, setKitchenName] = useState('');
  const [memberIdentifiers, setMemberIdentifiers] = useState({});
  const [memberErrors, setMemberErrors] = useState({});
  const [avoidedFood, setAvoidedFood] = useState('');
  const [avoidedFoods, setAvoidedFoods] = useState([]);
  const [foodPreferenceError, setFoodPreferenceError] = useState('');
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const loadKitchens = async () => {
    try {
      const response = await api.get('/kitchens');
      setKitchens(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to load kitchens.');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadKitchens();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setAvoidedFoods(Array.isArray(user?.avoidedFoods) ? user.avoidedFoods : []);
  }, [user?.avoidedFoods]);

  const handleCreateKitchen = async (event) => {
    event.preventDefault();
    try {
      const response = await api.post('/kitchens', { name: kitchenName });
      setKitchenName('');
      await loadKitchens();
      navigate(`/manual-split/${response.data.id}`);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to create kitchen.');
    }
  };

  const handleAddMember = async (event, kitchenId) => {
    event.preventDefault();
    const identifier = memberIdentifiers[kitchenId]?.trim();
    if (!identifier) {
      setMemberErrors((errors) => ({ ...errors, [kitchenId]: 'Enter an email or username.' }));
      return;
    }
    try {
      await api.post(`/kitchens/${kitchenId}/members`, { identifier, role: 'member' });
      setMemberIdentifiers((identifiers) => ({ ...identifiers, [kitchenId]: '' }));
      setMemberErrors((errors) => ({ ...errors, [kitchenId]: '' }));
      await loadKitchens();
    } catch (requestError) {
      setMemberErrors((errors) => ({ ...errors, [kitchenId]: requestError.response?.data?.detail || 'Unable to add member.' }));
    }
  };

  const saveAvoidedFoods = async (nextFoods) => {
    try {
      const response = await api.put('/auth/me/avoided-foods', { avoidedFoods: nextFoods });
      setAvoidedFoods(response.data.avoidedFoods);
      setFoodPreferenceError('');
      await loadUser();
    } catch (requestError) {
      setFoodPreferenceError(requestError.response?.data?.detail || 'Unable to save food preferences.');
    }
  };

  const handleAddAvoidedFood = async (event) => {
    event.preventDefault();
    const food = avoidedFood.trim().toLowerCase();
    if (!food || avoidedFoods.includes(food)) return;
    setAvoidedFood('');
    await saveAvoidedFoods([...avoidedFoods, food]);
  };

  const handleLogout = async () => {
    setAccountMenuOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <div className={`dashboard-page${darkMode ? ' dashboard-dark' : ''}`}>
      <motion.header className="dashboard-header" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <p className="dashboard-logo">
          <span className="dashboard-logo-kitchen">Kitchen</span>
          <span className="dashboard-logo-split">Split</span>
        </p>
        <div className="dashboard-header-account">
          <span className="dashboard-kitchen-name">My kitchens</span>
          <button className="dashboard-theme-toggle" type="button" title={darkMode ? 'Use light mode' : 'Use dark mode'} aria-label={darkMode ? 'Use light mode' : 'Use dark mode'} aria-pressed={darkMode} onClick={() => setDarkMode((enabled) => !enabled)}>
            {darkMode ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
          </button>
          <div className="dashboard-account-menu">
            <motion.button className="dashboard-account-trigger" type="button" aria-expanded={accountMenuOpen} aria-controls="dashboard-account-dropdown" onClick={() => setAccountMenuOpen((isOpen) => !isOpen)} whileTap={{ scale: 0.97 }}>
              <FaCircleUser className="dashboard-account-icon" aria-hidden="true" />
              <span className="dashboard-account-name">{user?.username || 'Account'}</span>
              <FaChevronDown className={`dashboard-account-chevron${accountMenuOpen ? ' dashboard-account-chevron-open' : ''}`} aria-hidden="true" />
            </motion.button>
            <AnimatePresence>
              {accountMenuOpen && (
                <motion.div id="dashboard-account-dropdown" className="dashboard-account-dropdown" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}>
                  <button className="dashboard-account-logout" type="button" onClick={handleLogout}>Log out</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.header>
      <div className="dashboard-shell">
        <section className="dashboard-intro">
          <h1>Hello, {user?.username}</h1>
          <p>Choose a kitchen or create a new shared space.</p>
        </section>

        <section className="dashboard-card">
          <h2>Create a kitchen</h2>
          <form onSubmit={handleCreateKitchen}>
            <input value={kitchenName} placeholder="Kitchen name" onChange={(event) => setKitchenName(event.target.value)} />
            <button type="submit">Create kitchen</button>
          </form>
          {error && <p className="dashboard-error">{error}</p>}
        </section>

        <section className="dashboard-card food-preferences-card">
          <h2>Foods you avoid</h2>
          <form className="food-preferences-form" onSubmit={handleAddAvoidedFood}>
            <input value={avoidedFood} placeholder="Food name, e.g. chicken" onChange={(event) => setAvoidedFood(event.target.value)} />
            <button type="submit">Add food</button>
          </form>
          {avoidedFoods.length > 0 && <div className="avoided-food-list">{avoidedFoods.map((food) => <span key={food}>{food}<button type="button" title={`Remove ${food}`} aria-label={`Remove ${food}`} onClick={() => saveAvoidedFoods(avoidedFoods.filter((avoided) => avoided !== food))}>Remove</button></span>)}</div>}
          {foodPreferenceError && <p className="dashboard-error">{foodPreferenceError}</p>}
        </section>

        <section className="dashboard-card">
          <h2>Your kitchens</h2>
          <div className="kitchen-grid">
            {kitchens.map((kitchen) => (
              <article className="kitchen-card" key={kitchen.id}>
                <h3>{kitchen.name}</h3>
                <p className="kitchen-meta">Role: {kitchen.role}</p>
                <p className="kitchen-meta">Members: {kitchen.memberCount}</p>
                {(kitchen.role === 'owner' || kitchen.role === 'admin') && (
                  <form className="add-member-form" onSubmit={(event) => handleAddMember(event, kitchen.id)}>
                    <label htmlFor={`member-identifier-${kitchen.id}`}>Add member</label>
                    <div>
                      <input id={`member-identifier-${kitchen.id}`} value={memberIdentifiers[kitchen.id] || ''} placeholder="Email or username" onChange={(event) => setMemberIdentifiers((identifiers) => ({ ...identifiers, [kitchen.id]: event.target.value }))} />
                      <button type="submit">Add</button>
                    </div>
                    {memberErrors[kitchen.id] && <p className="dashboard-error">{memberErrors[kitchen.id]}</p>}
                  </form>
                )}
                <button type="button" onClick={() => navigate(`/manual-split/${kitchen.id}`)}>
                  Open bills
                </button>
              </article>
            ))}
            {kitchens.length === 0 && <p>No kitchens yet. Create one to start splitting bills.</p>}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
