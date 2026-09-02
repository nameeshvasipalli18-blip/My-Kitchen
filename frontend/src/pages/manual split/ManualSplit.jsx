import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { EnterBillsWorkspace } from '../../components/item inputs/EnterBillsWorkspace.jsx';
import { RecentTrips } from '../../components/item cards/RecentTrips.jsx';
import { Results } from '../../components/results/Results.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../api.js';
import { FaCalculator, FaChevronDown, FaCircleUser, FaMoon, FaPenToSquare, FaReceipt, FaSun, FaUsers, FaUtensils, FaXmark } from 'react-icons/fa6';
import './ManualSplit.css';

const ManualSplit = () => {
  const { kitchenId } = useParams();
  const navigate = useNavigate();
  const { user, logout, loadUser } = useAuth();
  const [initialInputs, setInitialInputs] = useState([]);
  const [activeWindow, setActiveWindow] = useState('enter-bills');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [newlySavedTripId, setNewlySavedTripId] = useState(null);
  const [editingTripId, setEditingTripId] = useState(null);
  const [shoppingTrips, setShoppingTrips] = useState([]);
  const [kitchenName, setKitchenName] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [kitchenMembers, setKitchenMembers] = useState([]);
  const [kitchens, setKitchens] = useState([]);
  const [activeAccountOption, setActiveAccountOption] = useState(null);
  const [modal, setModal] = useState(null);
  const [memberIdentifier, setMemberIdentifier] = useState('');
  const [kitchenDraftName, setKitchenDraftName] = useState('');
  const [selectedKitchenId, setSelectedKitchenId] = useState('');
  const [avoidedFoods, setAvoidedFoods] = useState([]);
  const [newAvoidedFood, setNewAvoidedFood] = useState('');
  const [accountError, setAccountError] = useState('');
  const [mobileKeyboardOpen, setMobileKeyboardOpen] = useState(false);
  const viewportHeightRef = useRef(0);

  const createDefaultTrip = useCallback((names) => ({
    id: Date.now(),
    date: new Date().toISOString().split('T')[0],
    store: 'lidl',
    participants: [...names],
    defaultPayer: names.includes(user?.username) ? user.username : names[0] || '',
    defaultSplit: { type: 'all', between: [...names] },
    items: [],
  }), [user]);

  const [shoppingTrip, setShoppingTrip] = useState(createDefaultTrip([]));

  const refreshKitchenMembers = useCallback(async (isActive = () => true) => {
    const response = await api.get(`/kitchens/${kitchenId}`);
    if (!isActive()) {
      return;
    }
    const kitchen = response.data;
    const names = kitchen.members.map((member) => member.username);
    setKitchenName(kitchen.name);
    setKitchenMembers(kitchen.members);
    setInitialInputs(names);
    setShoppingTrip((previousTrip) => {
      if (previousTrip.items.length > 0 || previousTrip.participants.length > 0 || previousTrip.defaultPayer) {
        return previousTrip;
      }
      return createDefaultTrip(names);
    });
  }, [createDefaultTrip, kitchenId]);

  const loadBills = useCallback(async (isActive = () => true) => {
    const response = await api.get(`/kitchens/${kitchenId}/bills`);
    if (!isActive()) {
      return;
    }
    setShoppingTrips(Array.isArray(response.data?.trips) ? response.data.trips : []);
  }, [kitchenId]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await refreshKitchenMembers(() => active);
        await loadBills(() => active);
      } catch {
        if (active) {
          navigate('/dashboard');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [loadBills, navigate, refreshKitchenMembers]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;

    const updateKeyboardState = () => {
      viewportHeightRef.current = Math.max(viewportHeightRef.current, viewport.height);
      const activeElement = document.activeElement;
      const editableControlIsFocused = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLSelectElement;
      const keyboardHeight = viewportHeightRef.current - viewport.height;
      setMobileKeyboardOpen(window.innerWidth <= 700 && editableControlIsFocused && keyboardHeight > 150);
    };

    updateKeyboardState();
    viewport.addEventListener('resize', updateKeyboardState);
    window.addEventListener('focusin', updateKeyboardState);
    window.addEventListener('focusout', updateKeyboardState);
    return () => {
      viewport.removeEventListener('resize', updateKeyboardState);
      window.removeEventListener('focusin', updateKeyboardState);
      window.removeEventListener('focusout', updateKeyboardState);
    };
  }, []);

  const editTrip = (trip) => {
    setShoppingTrip({
      id: trip.id,
      date: trip.date,
      store: trip.store,
      participants: Array.isArray(trip.participants) ? [...trip.participants] : [],
      defaultPayer: trip.defaultPayer,
      defaultSplit: {
        type: trip.defaultSplit?.type || 'all',
        between: Array.isArray(trip.defaultSplit?.between) ? [...trip.defaultSplit.between] : [],
      },
      items: Array.isArray(trip.items) ? trip.items.map((item) => ({ ...item, splitBetween: Array.isArray(item.splitBetween) ? [...item.splitBetween] : [] })) : [],
    });
    setEditingTripId(trip.dbTripId ?? trip.id);
  };

  const deleteTrip = async (trip) => {
    const persistedId = trip.dbTripId ?? trip.id;
    if (!Number.isInteger(persistedId)) {
      return;
    }
    await api.delete(`/kitchens/${kitchenId}/bills/${persistedId}`);
    await loadBills();
  };

  const highlightSavedTrip = async (savedId) => {
    setNewlySavedTripId(savedId);
    setTimeout(() => setNewlySavedTripId(null), 450);
    await loadBills();
  };

  const splitResult = useMemo(() => {
    const balances = Object.fromEntries(initialInputs.map((name) => [name, 0]));
    let total = 0;

    shoppingTrips.forEach((trip) => {
      trip.items?.forEach((item) => {
        const amount = Number(item.price) || 0;
        const splitBetween = item.splitBetween?.length ? item.splitBetween : trip.participants || [];
        if (!amount || !item.paidBy || splitBetween.length === 0) {
          return;
        }
        balances[item.paidBy] = (balances[item.paidBy] || 0) + amount;
        const share = amount / splitBetween.length;
        splitBetween.forEach((name) => {
          balances[name] = (balances[name] || 0) - share;
        });
        total += amount;
      });
    });

    const creditors = Object.entries(balances).filter(([, amount]) => amount > 0.005).map(([name, amount]) => ({ name, amount }));
    const debtors = Object.entries(balances).filter(([, amount]) => amount < -0.005).map(([name, amount]) => ({ name, amount: -amount }));
    const settlements = [];
    let creditorIndex = 0;
    let debtorIndex = 0;
    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const creditor = creditors[creditorIndex];
      const debtor = debtors[debtorIndex];
      const amount = Math.min(creditor.amount, debtor.amount);
      settlements.push({ from: debtor.name, to: creditor.name, amount });
      creditor.amount -= amount;
      debtor.amount -= amount;
      if (creditor.amount < 0.005) creditorIndex += 1;
      if (debtor.amount < 0.005) debtorIndex += 1;
    }

    return { participants: initialInputs, balances, settlements, total };
  }, [initialInputs, shoppingTrips]);

  const handleLogout = async () => {
    setAccountMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const closeAccountPanels = () => {
    setAccountMenuOpen(false);
    setActiveAccountOption(null);
  };

  const loadKitchens = async () => {
    const response = await api.get('/kitchens');
    setKitchens(Array.isArray(response.data) ? response.data : []);
  };

  const openModal = async (nextModal) => {
    setAccountError('');
    if (nextModal === 'foods') {
      setAvoidedFoods(Array.isArray(user?.avoidedFoods) ? user.avoidedFoods : []);
      setNewAvoidedFood('');
    }
    if (nextModal === 'kitchens') {
      try {
        await loadKitchens();
      } catch (requestError) {
        setAccountError(requestError.response?.data?.detail || 'Unable to load kitchens.');
      }
    }
    setModal(nextModal);
    closeAccountPanels();
  };

  const handleSelectMember = (username) => {
    setShoppingTrip((trip) => ({ ...trip, defaultPayer: username }));
    closeAccountPanels();
  };

  const handleAddMember = async (event) => {
    event.preventDefault();
    const identifier = memberIdentifier.trim();
    if (!identifier) return;
    try {
      await api.post(`/kitchens/${kitchenId}/members`, { identifier, role: 'member' });
      setMemberIdentifier('');
      setAccountError('');
      await refreshKitchenMembers();
      setModal(null);
    } catch (requestError) {
      setAccountError(requestError.response?.data?.detail || 'Unable to add member.');
    }
  };

  const handleSaveKitchen = async (event) => {
    event.preventDefault();
    const name = kitchenDraftName.trim();
    if (!name) return;
    try {
      if (selectedKitchenId) {
        await api.patch(`/kitchens/${selectedKitchenId}`, { name });
        if (Number(selectedKitchenId) === Number(kitchenId)) setKitchenName(name);
      } else {
        await api.post('/kitchens', { name });
      }
      setKitchenDraftName('');
      setSelectedKitchenId('');
      setAccountError('');
      await loadKitchens();
    } catch (requestError) {
      setAccountError(requestError.response?.data?.detail || 'Unable to save kitchen.');
    }
  };

  const handleSaveAvoidedFoods = async (event) => {
    event.preventDefault();
    const foods = newAvoidedFood.trim() ? [...avoidedFoods, newAvoidedFood.trim().toLowerCase()] : avoidedFoods;
    const normalizedFoods = [...new Set(foods.map((food) => food.trim().toLowerCase()).filter(Boolean))];
    try {
      const response = await api.put('/auth/me/avoided-foods', { avoidedFoods: normalizedFoods });
      setAvoidedFoods(response.data.avoidedFoods);
      setNewAvoidedFood('');
      setAccountError('');
      await loadUser();
    } catch (requestError) {
      setAccountError(requestError.response?.data?.detail || 'Unable to save avoided foods.');
    }
  };

  const canManageMembers = kitchenMembers.some((member) => member.username === user?.username && ['owner', 'admin'].includes(member.role));

  return (
    <motion.div className={`kitchen-split-container${darkMode ? ' kitchen-split-dark' : ''}${mobileKeyboardOpen ? ' kitchen-split-keyboard-open' : ''}`} initial="hidden" animate="visible" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.2 } } }}>
      <motion.div className="kitchen-split-header" variants={{ hidden: { opacity: 0, y: -12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } }}>
        <p className="kitchen-split-logo">
          <span className="kitchen-split-logo-kitchen">{kitchenName || 'Kitchen'}</span>
          <span className="kitchen-split-logo-split">Split</span>
        </p>
        <div className="header-kitchen-account">
          <button className="header-theme-toggle" type="button" title={darkMode ? 'Use light mode' : 'Use dark mode'} aria-label={darkMode ? 'Use light mode' : 'Use dark mode'} aria-pressed={darkMode} onClick={() => setDarkMode((enabled) => !enabled)}>
            {darkMode ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
          </button>
          <div className="header-account-menu">
            <motion.button className="header-account-trigger" type="button" aria-expanded={accountMenuOpen} aria-controls="header-account-dropdown" onClick={() => setAccountMenuOpen((isOpen) => !isOpen)} whileTap={{ scale: 0.97 }}>
              <FaCircleUser className="header-account-icon" aria-hidden="true" />
              <span className="header-account-name">{user?.username || 'Account'}</span>
              <FaChevronDown className={`header-account-chevron${accountMenuOpen ? ' header-account-chevron-open' : ''}`} aria-hidden="true" />
            </motion.button>
            <AnimatePresence>
              {accountMenuOpen && (
                <motion.div id="header-account-dropdown" className="header-account-dropdown" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}>
                  <button type="button" onMouseEnter={() => setActiveAccountOption('members')} onFocus={() => setActiveAccountOption('members')} onClick={() => setActiveAccountOption('members')}><FaUsers aria-hidden="true" />Members</button>
                  <button type="button" onMouseEnter={() => setActiveAccountOption('kitchens')} onFocus={() => setActiveAccountOption('kitchens')} onClick={() => setActiveAccountOption('kitchens')}><FaUtensils aria-hidden="true" />Kitchens</button>
                  <button type="button" onMouseEnter={() => setActiveAccountOption('foods')} onFocus={() => setActiveAccountOption('foods')} onClick={() => setActiveAccountOption('foods')}>Avoided foods</button>
                  <button className="header-account-logout" type="button" onClick={handleLogout}>Log out</button>
                  <AnimatePresence>
                    {activeAccountOption === 'members' && <motion.div className="header-account-submenu" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} onMouseLeave={() => setActiveAccountOption(null)}><span className="header-account-members-label">Set bill payer</span>{kitchenMembers.map((member) => <button key={member.membershipId} type="button" className={shoppingTrip.defaultPayer === member.username ? 'header-submenu-selected' : ''} onClick={() => handleSelectMember(member.username)}>{member.username}</button>)}{canManageMembers && <button type="button" className="header-submenu-action" onClick={() => openModal('members')}>Add member</button>}</motion.div>}
                    {activeAccountOption === 'kitchens' && <motion.div className="header-account-submenu" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} onMouseLeave={() => setActiveAccountOption(null)}><span className="header-account-members-label">Your kitchens</span><span className="header-account-members-empty">Create or rename kitchens.</span><button type="button" className="header-submenu-action" onClick={() => openModal('kitchens')}>Add / edit kitchens</button></motion.div>}
                    {activeAccountOption === 'foods' && <motion.div className="header-account-submenu" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} onMouseLeave={() => setActiveAccountOption(null)}><span className="header-account-members-label">Avoided foods</span>{user?.avoidedFoods?.length ? user.avoidedFoods.map((food) => <span key={food} className="header-account-members-empty">{food}</span>) : <span className="header-account-members-empty">None saved</span>}<button type="button" className="header-submenu-action" onClick={() => openModal('foods')}>Add / edit foods</button></motion.div>}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
      <AnimatePresence>
        {modal && (
          <motion.div className="account-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setModal(null)}>
            <motion.section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} onMouseDown={(event) => event.stopPropagation()}>
              <header><h2 id="account-modal-title">{modal === 'members' ? 'Add kitchen member' : modal === 'kitchens' ? 'Manage kitchens' : 'Avoided foods'}</h2><button className="account-modal-close" type="button" aria-label="Close dialog" title="Close" onClick={() => setModal(null)}><FaXmark aria-hidden="true" /></button></header>
              {modal === 'members' && <form onSubmit={handleAddMember}><label>Email or username<input value={memberIdentifier} onChange={(event) => setMemberIdentifier(event.target.value)} autoFocus /></label><button type="submit">Add member</button></form>}
              {modal === 'kitchens' && <><div className="account-modal-list">{kitchens.map((kitchen) => <button key={kitchen.id} type="button" className={Number(selectedKitchenId) === kitchen.id ? 'account-modal-list-selected' : ''} onClick={() => { setSelectedKitchenId(String(kitchen.id)); setKitchenDraftName(kitchen.name); }}>{kitchen.name}</button>)}</div><form onSubmit={handleSaveKitchen}><label>Kitchen name<input value={kitchenDraftName} onChange={(event) => setKitchenDraftName(event.target.value)} placeholder="New kitchen name" /></label><div className="account-modal-actions"><button type="button" onClick={() => { setSelectedKitchenId(''); setKitchenDraftName(''); }}>New kitchen</button><button type="submit">{selectedKitchenId ? 'Save kitchen' : 'Add kitchen'}</button></div></form></>}
              {modal === 'foods' && <form onSubmit={handleSaveAvoidedFoods}><div className="account-food-editor">{avoidedFoods.map((food, index) => <label key={`${food}-${index}`}>Avoided food<input value={food} onChange={(event) => setAvoidedFoods((foods) => foods.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /><button type="button" onClick={() => setAvoidedFoods((foods) => foods.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></label>)}</div><label>Add food<input value={newAvoidedFood} onChange={(event) => setNewAvoidedFood(event.target.value)} placeholder="e.g. peanuts" /></label><button type="submit">Save foods</button></form>}
              {accountError && <p className="account-modal-error">{accountError}</p>}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="kitchen-split-body">
        <motion.div className="kitchen-split-content" initial={activeWindow === 'enter-bills' && shoppingTrip.items.length === 0 ? { opacity: 0 } : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.1, duration: 0.35 } }}>
          {activeWindow === 'enter-bills' && initialInputs.length > 0 && (
            <EnterBillsWorkspace
              kitchenId={Number(kitchenId)}
              initialInputs={initialInputs}
              shoppingTrip={shoppingTrip}
              setShoppingTrip={setShoppingTrip}
              setShoppingTrips={setShoppingTrips}
              onTripSaved={highlightSavedTrip}
              editingTripId={editingTripId}
              setEditingTripId={setEditingTripId}
              mobileKeyboardOpen={mobileKeyboardOpen}
            />
          )}
          {activeWindow === 'saved-bills' && (
            <RecentTrips participants={initialInputs.map((name) => ({ name, theme: {} }))} shoppingTrips={shoppingTrips} newlySavedTripId={newlySavedTripId} onEditTrip={(trip) => { editTrip(trip); setActiveWindow('enter-bills'); }} onDeleteTrip={deleteTrip} isMenuOpen showMenuToggle={false} />
          )}
          {activeWindow === 'splits' && <Results result={splitResult} />}
        </motion.div>
      </div>
      <nav className="kitchen-window-navigation" aria-label="Kitchen windows">
        <motion.button className={activeWindow === 'enter-bills' ? 'kitchen-window-button kitchen-window-button-active' : 'kitchen-window-button'} type="button" onClick={() => setActiveWindow('enter-bills')} whileTap={{ scale: 0.97 }}>
          <FaPenToSquare aria-hidden="true" />
          <span>Enter bills</span>
        </motion.button>
        <motion.button className={activeWindow === 'saved-bills' ? 'kitchen-window-button kitchen-window-button-active' : 'kitchen-window-button'} type="button" onClick={() => setActiveWindow('saved-bills')} whileTap={{ scale: 0.97 }}>
          <FaReceipt aria-hidden="true" />
          <span>Saved bills</span>
        </motion.button>
        <motion.button className={activeWindow === 'splits' ? 'kitchen-window-button kitchen-window-button-active' : 'kitchen-window-button'} type="button" onClick={() => setActiveWindow('splits')} whileTap={{ scale: 0.97 }}>
          <FaCalculator aria-hidden="true" />
          <span>Splits &amp; history</span>
        </motion.button>
      </nav>
    </motion.div>
  );
};

export default ManualSplit;
