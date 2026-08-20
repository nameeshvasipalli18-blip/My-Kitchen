import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Participants } from '../../components/participants/Participants.jsx';
import { TripManager } from '../../components/item inputs/TripManager.jsx';
import { ItemCards } from '../../components/item cards/ItemCards.jsx';
import { RecentTrips } from '../../components/item cards/RecentTrips.jsx';
import { themes } from '../../components/themes/themes.jsx';
import api from '../../api.js';
import { FaKitchenSet, FaReceipt, FaUsers } from 'react-icons/fa6';
import './ManualSplit.css';

const ManualSplit = () => {
  const { kitchenId } = useParams();
  const navigate = useNavigate();
  const emptyItem = useMemo(() => ({ name: '', price: '', paidBy: '', splitType: '', splitBetween: [] }), []);
  const [initialInputs, setInitialInputs] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [memberDetails, setMemberDetails] = useState([]);
  const [activeMenu, setActiveMenu] = useState(null);
  const [closingMenu, setClosingMenu] = useState(null);
  const [tripStarted, setTripStarted] = useState(false);
  const [tripDefaultsEditable, setTripDefaultsEditable] = useState(true);
  const [activeTripEntering, setActiveTripEntering] = useState(false);
  const [activeTripClosing, setActiveTripClosing] = useState(false);
  const [isSavingTrip, setIsSavingTrip] = useState(false);
  const [newlySavedTripId, setNewlySavedTripId] = useState(null);
  const [editingTripId, setEditingTripId] = useState(null);
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [newlyAddedItemIndex, setNewlyAddedItemIndex] = useState(null);
  const [shoppingTrips, setShoppingTrips] = useState([]);
  const [selectedItemIndex, setSelectedItemIndex] = useState(null);
  const [, setCurrentItem] = useState(emptyItem);
  const itemNameRef = useRef(null);
  const inputRef = useRef([]);
  const [kitchenName, setKitchenName] = useState('');

  const buildParticipants = (names) => names.map((name, index) => ({ name, theme: themes[index % themes.length] }));

  const createDefaultTrip = useCallback((names) => ({
    id: Date.now(),
    date: new Date().toISOString().split('T')[0],
    store: 'lidl',
    participants: [...names],
    defaultPayer: names[0] || '',
    defaultSplit: { type: 'all', between: [...names] },
    items: [],
  }), []);

  const [shoppingTrip, setShoppingTrip] = useState(createDefaultTrip([]));

  const refreshKitchenMembers = useCallback(async (isActive = () => true) => {
    const response = await api.get(`/kitchens/${kitchenId}`);
    if (!isActive()) {
      return;
    }
    const kitchen = response.data;
    const names = kitchen.members.map((member) => member.username);
    setKitchenName(kitchen.name);
    setMemberDetails(kitchen.members);
    setInitialInputs(names);
    setParticipants(buildParticipants(names));
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
    setEditingItemIndex(null);
    setTripDefaultsEditable(false);
    setTripStarted(true);
    animateActiveTripEntry();
  };

  const deleteTrip = async (trip) => {
    const persistedId = trip.dbTripId ?? trip.id;
    if (!Number.isInteger(persistedId)) {
      return;
    }
    await api.delete(`/kitchens/${kitchenId}/bills/${persistedId}`);
    await loadBills();
  };

  const deleteActiveTrip = async () => {
    if (Number.isInteger(editingTripId)) {
      await deleteTrip({ id: editingTripId });
    }
    setTripStarted(false);
    setTripDefaultsEditable(true);
    setEditingTripId(null);
    setEditingItemIndex(null);
    setShoppingTrip(createDefaultTrip(initialInputs));
  };

  const closeActiveTrip = async () => {
    if (!Number.isInteger(editingTripId) || activeTripClosing) {
      return;
    }
    try {
      await api.put(`/kitchens/${kitchenId}/bills/${editingTripId}`, shoppingTrip);
      await loadBills();
      setActiveTripClosing(true);
      setTimeout(() => {
        setShoppingTrip(createDefaultTrip(initialInputs));
        setTripStarted(false);
        setTripDefaultsEditable(true);
        setEditingTripId(null);
        setEditingItemIndex(null);
        setActiveTripClosing(false);
      }, 250);
    } catch {
      // ignore and keep current state
    }
  };

  const deleteActiveItem = (itemIndex) => {
    setShoppingTrip((trip) => ({ ...trip, items: trip.items.filter((_, index) => index !== itemIndex) }));
    setEditingItemIndex((currentIndex) => {
      if (currentIndex === itemIndex) return null;
      return currentIndex !== null && currentIndex > itemIndex ? currentIndex - 1 : currentIndex;
    });
  };

  const highlightAddedItem = (itemIndex) => {
    setNewlyAddedItemIndex(itemIndex);
    setTimeout(() => setNewlyAddedItemIndex(null), 350);
  };

  const highlightSavedTrip = async (savedId) => {
    setNewlySavedTripId(savedId);
    setTimeout(() => setNewlySavedTripId(null), 450);
    await loadBills();
  };

  const animateActiveTripEntry = () => {
    setActiveTripEntering(true);
    setTimeout(() => setActiveTripEntering(false), 300);
  };

  const participantCount = initialInputs.filter((name) => String(name).trim()).length;
  const participantsPanelVisible = activeMenu === 'participants' || closingMenu === 'participants';
  const billsPanelVisible = activeMenu === 'bills' || closingMenu === 'bills';
  const menuPanelOpen = activeMenu !== null || closingMenu !== null;

  const toggleParticipantsMenu = () => {
    if (activeMenu === 'participants') {
      setClosingMenu('participants');
      setTimeout(() => {
        setActiveMenu(null);
        setClosingMenu(null);
      }, 250);
      return;
    }
    setClosingMenu(null);
    setActiveMenu('participants');
  };

  const toggleBillsMenu = () => {
    if (activeMenu === 'bills') {
      setClosingMenu('bills');
      setTimeout(() => {
        setActiveMenu(null);
        setClosingMenu(null);
      }, 250);
      return;
    }
    setClosingMenu(null);
    setActiveMenu('bills');
  };

  return (
    <div className="kitchen-split-container">
      <div className="kitchen-split-header">
        <p className="kitchen-split-logo">
          <span className="kitchen-split-logo-kitchen">Kitchen</span>
          <span className="kitchen-split-logo-split">Split</span>
        </p>
        <button className="kitchens-navigation-button" type="button" title="View kitchens" aria-label="View kitchens" onClick={() => navigate('/dashboard')}>
          <FaKitchenSet aria-hidden="true" />
        </button>
      </div>
      <div className={`kitchen-split-body${menuPanelOpen ? ' menu-panel-open' : ''}${participantsPanelVisible ? ' participants-menu-open' : ''}`}>
        <nav className="kitchen-split-menu" aria-label="Kitchen Split menu">
          <button className={`kitchen-menu-button${activeMenu === 'participants' ? ' kitchen-menu-button-active' : ''}`} type="button" title="Show members" aria-label="Show members" aria-pressed={activeMenu === 'participants'} onClick={toggleParticipantsMenu}>
            <FaUsers aria-hidden="true" />
            <span className="kitchen-menu-label">Members</span>
          </button>
          <button className={`kitchen-menu-button${activeMenu === 'bills' ? ' kitchen-menu-button-active' : ''}`} type="button" title="Show recent bills" aria-label="Show recent bills" aria-pressed={activeMenu === 'bills'} onClick={toggleBillsMenu}>
            <FaReceipt aria-hidden="true" />
            <span className="kitchen-menu-label">Recent bills</span>
          </button>
        </nav>

        {menuPanelOpen && (
          <aside className={`kitchen-split-menu-panel${participantsPanelVisible ? ' participants-menu-panel' : ''}${closingMenu === 'participants' ? ' participants-menu-panel-closing' : ''}${billsPanelVisible ? ' bills-menu-panel' : ''}${closingMenu === 'bills' ? ' bills-menu-panel-closing' : ''}`}>
            {participantsPanelVisible && (
              <Participants
                kitchenId={Number(kitchenId)}
                initialInputs={initialInputs}
                setInitialInputs={setInitialInputs}
                setParticipants={setParticipants}
                memberDetails={memberDetails}
                refreshKitchenMembers={refreshKitchenMembers}
                inputRef={inputRef}
                itemNameRef={itemNameRef}
                isMenuOpen
                showMenuToggle={false}
              />
            )}
            {billsPanelVisible && (
              <RecentTrips participants={participants} shoppingTrips={shoppingTrips} newlySavedTripId={newlySavedTripId} onEditTrip={editTrip} onDeleteTrip={deleteTrip} isMenuOpen showMenuToggle={false} />
            )}
          </aside>
        )}

        <div className="kitchen-split-content">
          {initialInputs.length > 0 && (
            <TripManager
              kitchenId={Number(kitchenId)}
              initialInputs={initialInputs}
              itemNameRef={itemNameRef}
              shoppingTrip={shoppingTrip}
              setShoppingTrip={setShoppingTrip}
              setShoppingTrips={setShoppingTrips}
              setTripStarted={setTripStarted}
              tripStarted={tripStarted}
              tripDefaultsEditable={tripDefaultsEditable}
              setTripDefaultsEditable={setTripDefaultsEditable}
              isSavingTrip={isSavingTrip}
              setIsSavingTrip={setIsSavingTrip}
              onTripSaved={highlightSavedTrip}
              onItemAdded={highlightAddedItem}
              onTripStarted={animateActiveTripEntry}
              editingTripId={editingTripId}
              setEditingTripId={setEditingTripId}
              editingItemIndex={editingItemIndex}
              setEditingItemIndex={setEditingItemIndex}
            />
          )}
          {initialInputs.length > 0 && (tripStarted || shoppingTrips.length > 0) && (
            <ItemCards
              kitchenId={Number(kitchenId)}
              selectedItemIndex={selectedItemIndex}
              setSelectedItemIndex={setSelectedItemIndex}
              setCurrentItem={setCurrentItem}
              itemNameRef={itemNameRef}
              participants={participants}
              shoppingTrips={shoppingTrips}
              setShoppingTrips={setShoppingTrips}
              activeTrip={tripStarted ? shoppingTrip : null}
              activeTripEntering={activeTripEntering}
              activeTripClosing={activeTripClosing}
              isSavingTrip={isSavingTrip}
              newlyAddedItemIndex={newlyAddedItemIndex}
              showSavedTrips={false}
              onEditActiveItem={setEditingItemIndex}
              onDeleteActiveItem={deleteActiveItem}
              onDeleteActiveTrip={deleteActiveTrip}
              onEditActiveTrip={() => setTripDefaultsEditable(true)}
              isEditingActiveTrip={Number.isInteger(editingTripId)}
              onCloseActiveTrip={closeActiveTrip}
            />
            )}
        </div>
      </div>
    </div>
  );
};

export default ManualSplit;
