import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FaBowlFood, FaCheck, FaChevronDown, FaCircleUser, FaMoon, FaPen, FaSun, FaTrash, FaUsersGear, FaUtensils, FaXmark } from 'react-icons/fa6';
import api from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout, loadUser } = useAuth();
  const [kitchens, setKitchens] = useState([]);
  const [kitchenName, setKitchenName] = useState('');
  const [memberIdentifiers, setMemberIdentifiers] = useState({});
  const [selectedKitchenId, setSelectedKitchenId] = useState('');
  const [kitchenDialogOpen, setKitchenDialogOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [foodPreferencesDialogOpen, setFoodPreferencesDialogOpen] = useState(false);
  const [editingKitchenId, setEditingKitchenId] = useState(null);
  const kitchenNameInputs = useRef({});
  const [memberErrors, setMemberErrors] = useState({});
  const [avoidedFood, setAvoidedFood] = useState('');
  const [avoidedFoods, setAvoidedFoods] = useState([]);
  const [editingAvoidedFood, setEditingAvoidedFood] = useState(null);
  const [editedAvoidedFood, setEditedAvoidedFood] = useState('');
  const [foodPreferenceError, setFoodPreferenceError] = useState('');
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const loadKitchens = async () => {
    try {
      const response = await api.get('/kitchens');
      const summaries = Array.isArray(response.data) ? response.data : [];
      const details = await Promise.all(summaries.map(async (kitchen) => {
        const detailResponse = await api.get(`/kitchens/${kitchen.id}`);
        return detailResponse.data;
      }));
      setKitchens(details);
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

  useEffect(() => {
    if (editingKitchenId !== null) {
      kitchenNameInputs.current[editingKitchenId]?.focus();
    }
  }, [editingKitchenId]);

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

  const handleRenameKitchen = async (event, kitchenId) => {
    event.preventDefault();
    const name = event.currentTarget.elements.kitchenName.value.trim();
    if (!name) return;
    try {
      await api.patch(`/kitchens/${kitchenId}`, { name });
      await loadKitchens();
      setEditingKitchenId(null);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to update kitchen.');
    }
  };

  const handleRemoveMember = async (kitchenId, membershipId) => {
    try {
      await api.delete(`/kitchens/${kitchenId}/members/${membershipId}`);
      await loadKitchens();
    } catch (requestError) {
      setMemberErrors((errors) => ({ ...errors, [kitchenId]: requestError.response?.data?.detail || 'Unable to remove member.' }));
    }
  };

  const handleDeleteKitchen = async (kitchen) => {
    if (!window.confirm(`Delete ${kitchen.name} for every member, including all of its bills? This cannot be undone.`)) return;
    try {
      await api.delete(`/kitchens/${kitchen.id}`);
      setKitchens((currentKitchens) => currentKitchens.filter((currentKitchen) => currentKitchen.id !== kitchen.id));
      if (Number(selectedKitchenId) === kitchen.id) setSelectedKitchenId('');
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to delete kitchen.');
    }
  };

  const selectedKitchen = kitchens.find((kitchen) => kitchen.id === Number(selectedKitchenId));
  const canManageKitchen = (kitchen) => kitchen?.role === 'owner' || kitchen?.role === 'admin';

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

  const handleSaveAvoidedFood = async (event, originalFood) => {
    event.preventDefault();
    const food = editedAvoidedFood.trim().toLowerCase();
    if (!food || (food !== originalFood && avoidedFoods.includes(food))) return;
    await saveAvoidedFoods(avoidedFoods.map((avoidedFood) => avoidedFood === originalFood ? food : avoidedFood));
    setEditingAvoidedFood(null);
    setEditedAvoidedFood('');
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
          <div className="kitchens-section-header">
            <h2>Your kitchens</h2>
            <div className="kitchens-section-actions">
              <button className="kitchen-header-action" type="button" title="Add or edit kitchens" aria-label="Add or edit kitchens" onClick={() => setKitchenDialogOpen(true)}><FaUtensils aria-hidden="true" /></button>
              <button className="kitchen-header-action" type="button" title="Add or edit members" aria-label="Add or edit members" onClick={() => setMemberDialogOpen(true)} disabled={kitchens.length === 0}><FaUsersGear aria-hidden="true" /></button>
              <button className="kitchen-header-action" type="button" title="Manage food preferences" aria-label="Manage food preferences" onClick={() => setFoodPreferencesDialogOpen(true)}><FaBowlFood aria-hidden="true" /></button>
            </div>
          </div>
          {error && <p className="dashboard-error">{error}</p>}
          <div className="kitchen-grid">
            {kitchens.map((kitchen) => (
              <article className="kitchen-card" key={kitchen.id}>
                <form className="kitchen-name-form" onSubmit={(event) => handleRenameKitchen(event, kitchen.id)}>
                  <input ref={(input) => { kitchenNameInputs.current[kitchen.id] = input; }} name="kitchenName" defaultValue={kitchen.name} aria-label={`Kitchen name for ${kitchen.name}`} readOnly={editingKitchenId !== kitchen.id} />
                  {canManageKitchen(kitchen) && (editingKitchenId === kitchen.id ? <><button type="submit" title="Save kitchen name" aria-label="Save kitchen name"><FaCheck aria-hidden="true" /></button><button type="button" className="kitchen-name-cancel" title="Cancel editing" aria-label="Cancel editing" onClick={() => setEditingKitchenId(null)}><FaXmark aria-hidden="true" /></button></> : <button type="button" title="Edit kitchen name" aria-label="Edit kitchen name" onClick={() => setEditingKitchenId(kitchen.id)}><FaPen aria-hidden="true" /></button>)}
                </form>
                <p className="kitchen-meta">Role: {kitchen.role}</p>
                <div className="kitchen-members">
                  <span>Members</span>
                  <ul>{kitchen.members.map((member) => <li key={member.membershipId}>{member.username} <small>{member.role}</small></li>)}</ul>
                </div>
                <button type="button" onClick={() => navigate(`/manual-split/${kitchen.id}`)}>
                  Open bills
                </button>
                <button className="kitchen-delete" type="button" title={`Delete ${kitchen.name}`} onClick={() => handleDeleteKitchen(kitchen)}><FaTrash aria-hidden="true" />Delete kitchen</button>
              </article>
            ))}
            {kitchens.length === 0 && <p>No kitchens yet. Create one to start splitting bills.</p>}
          </div>
        </section>
      </div>
      <AnimatePresence>
        {kitchenDialogOpen && (
          <motion.div className="dashboard-dialog-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setKitchenDialogOpen(false)}>
            <motion.section className="dashboard-dialog" role="dialog" aria-modal="true" aria-labelledby="kitchen-dialog-title" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} onMouseDown={(event) => event.stopPropagation()}>
              <div className="dashboard-dialog-header"><h2 id="kitchen-dialog-title">Add a kitchen</h2><button type="button" className="dialog-close" aria-label="Close kitchen options" onClick={() => setKitchenDialogOpen(false)}>Close</button></div>
              <form onSubmit={handleCreateKitchen}>
                <input value={kitchenName} placeholder="Kitchen name" onChange={(event) => setKitchenName(event.target.value)} />
                <button type="submit">Create kitchen</button>
              </form>
            </motion.section>
          </motion.div>
        )}
        {memberDialogOpen && (
          <motion.div className="dashboard-dialog-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setMemberDialogOpen(false)}>
            <motion.section className="dashboard-dialog" role="dialog" aria-modal="true" aria-labelledby="member-dialog-title" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} onMouseDown={(event) => event.stopPropagation()}>
              <div className="dashboard-dialog-header"><h2 id="member-dialog-title">Manage members</h2><button type="button" className="dialog-close" aria-label="Close member options" onClick={() => setMemberDialogOpen(false)}>Close</button></div>
              <label className="dialog-select-label" htmlFor="member-kitchen">Kitchen</label>
              <select id="member-kitchen" value={selectedKitchenId} onChange={(event) => setSelectedKitchenId(event.target.value)}><option value="">Choose a kitchen</option>{kitchens.map((kitchen) => <option value={kitchen.id} key={kitchen.id}>{kitchen.name}</option>)}</select>
              {selectedKitchen && <>{canManageKitchen(selectedKitchen) ? <form className="dialog-member-form" onSubmit={(event) => handleAddMember(event, selectedKitchen.id)}><input value={memberIdentifiers[selectedKitchen.id] || ''} placeholder="Email or username" onChange={(event) => setMemberIdentifiers((identifiers) => ({ ...identifiers, [selectedKitchen.id]: event.target.value }))} /><button type="submit">Add member</button></form> : <p className="dashboard-error">Only owners and admins can manage members.</p>}<ul className="dialog-member-list">{selectedKitchen.members.map((member) => <li key={member.membershipId}><span>{member.username} <small>{member.email} · {member.role}</small></span>{canManageKitchen(selectedKitchen) && <button type="button" onClick={() => handleRemoveMember(selectedKitchen.id, member.membershipId)}>Remove</button>}</li>)}</ul>{memberErrors[selectedKitchen.id] && <p className="dashboard-error">{memberErrors[selectedKitchen.id]}</p>}</>}
            </motion.section>
          </motion.div>
        )}
        {foodPreferencesDialogOpen && (
          <motion.div className="dashboard-dialog-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setFoodPreferencesDialogOpen(false)}>
            <motion.section className="dashboard-dialog food-preferences-dialog" role="dialog" aria-modal="true" aria-labelledby="food-preferences-dialog-title" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} onMouseDown={(event) => event.stopPropagation()}>
              <div className="dashboard-dialog-header"><h2 id="food-preferences-dialog-title">Foods you avoid</h2><button type="button" className="dialog-close" aria-label="Close food preferences" onClick={() => setFoodPreferencesDialogOpen(false)}>Close</button></div>
              <form className="food-preferences-form" onSubmit={handleAddAvoidedFood}>
                <input value={avoidedFood} placeholder="Food name, e.g. chicken" onChange={(event) => setAvoidedFood(event.target.value)} autoFocus />
                <button type="submit">Add food</button>
              </form>
              {avoidedFoods.length > 0 && <section className="avoided-food-list" aria-labelledby="avoided-food-list-title"><h3 id="avoided-food-list-title">Avoided items</h3>{avoidedFoods.map((food) => <article className="avoided-food-card" key={food}>{editingAvoidedFood === food ? <form className="avoided-food-edit-form" onSubmit={(event) => handleSaveAvoidedFood(event, food)}><input value={editedAvoidedFood} aria-label={`Edit ${food}`} onChange={(event) => setEditedAvoidedFood(event.target.value)} autoFocus /><button type="submit" title={`Save ${food}`} aria-label={`Save ${food}`}><FaCheck aria-hidden="true" /></button><button type="button" className="avoided-food-cancel" title="Cancel editing" aria-label="Cancel editing" onClick={() => { setEditingAvoidedFood(null); setEditedAvoidedFood(''); }}><FaXmark aria-hidden="true" /></button></form> : <><span>{food}</span><div className="avoided-food-actions"><button type="button" className="avoided-food-edit" title={`Edit ${food}`} aria-label={`Edit ${food}`} onClick={() => { setEditingAvoidedFood(food); setEditedAvoidedFood(food); }}><FaPen aria-hidden="true" /></button><button type="button" className="avoided-food-remove" title={`Remove ${food}`} aria-label={`Remove ${food}`} onClick={() => saveAvoidedFoods(avoidedFoods.filter((avoided) => avoided !== food))}><FaXmark aria-hidden="true" /></button></div></>}</article>)}</section>}
              {foodPreferenceError && <p className="dashboard-error">{foodPreferenceError}</p>}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
