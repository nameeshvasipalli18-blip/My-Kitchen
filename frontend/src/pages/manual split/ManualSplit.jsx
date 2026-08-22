import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { EnterBillsWorkspace } from '../../components/item inputs/EnterBillsWorkspace.jsx';
import { RecentTrips } from '../../components/item cards/RecentTrips.jsx';
import { Results } from '../../components/results/Results.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../api.js';
import { FaCalculator, FaChevronDown, FaCircleUser, FaKitchenSet, FaMoon, FaPenToSquare, FaReceipt, FaSun } from 'react-icons/fa6';
import './ManualSplit.css';

const ManualSplit = () => {
  const { kitchenId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [initialInputs, setInitialInputs] = useState([]);
  const [activeWindow, setActiveWindow] = useState('enter-bills');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [newlySavedTripId, setNewlySavedTripId] = useState(null);
  const [editingTripId, setEditingTripId] = useState(null);
  const [shoppingTrips, setShoppingTrips] = useState([]);
  const [kitchenName, setKitchenName] = useState('');
  const [darkMode, setDarkMode] = useState(false);

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

  const openDashboard = () => {
    setAccountMenuOpen(false);
    navigate('/dashboard');
  };

  const handleLogout = async () => {
    setAccountMenuOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <motion.div className={`kitchen-split-container${darkMode ? ' kitchen-split-dark' : ''}`} initial="hidden" animate="visible" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.2 } } }}>
      <motion.div className="kitchen-split-header" variants={{ hidden: { opacity: 0, y: -12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } }}>
        <p className="kitchen-split-logo">
          <span className="kitchen-split-logo-kitchen">Kitchen</span>
          <span className="kitchen-split-logo-split">Split</span>
        </p>
        <div className="header-kitchen-account">
          <span className="header-kitchen-name">{kitchenName || 'Kitchen'}</span>
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
                  <button type="button" onClick={openDashboard}>
                    <FaKitchenSet aria-hidden="true" />
                    Dashboard
                  </button>
                  <div className="header-account-members">
                    <span className="header-account-members-label">Kitchen members</span>
                    {initialInputs.filter((name) => name !== user?.username).length > 0 ? (
                      <ul>
                        {initialInputs.filter((name) => name !== user?.username).map((name) => <li key={name}>{name}</li>)}
                      </ul>
                    ) : (
                      <span className="header-account-members-empty">No other members</span>
                    )}
                  </div>
                  <button className="header-account-logout" type="button" onClick={handleLogout}>Log out</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
      {activeWindow === 'enter-bills' && <div id="enter-bills-menu" className="enter-bills-menu" aria-label="Enter bills menu" />}
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
