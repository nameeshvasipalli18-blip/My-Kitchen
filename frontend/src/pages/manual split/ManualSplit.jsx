import {useState, useRef, useEffect} from 'react';
import {Participants} from '../../components/participants/Participants.jsx';
import {TripManager} from '../../components/item inputs/TripManager.jsx';
import { ItemCards } from '../../components/item cards/ItemCards.jsx';
import { RecentTrips } from '../../components/item cards/RecentTrips.jsx';
import {themes} from '../../components/themes/themes.jsx';
import api from '../../api.js';
import { FaReceipt, FaUsers } from 'react-icons/fa6';
import './ManualSplit.css';

const ManualSplit = () => {
  const emptyItem = {
    name: "",
    price: "",
    paidBy: "",
    splitType: "",
    splitBetween: []
  };
  const [splitBetween, setSplitBetween] = useState("");
  const [initialInputs, setInitialInputs] = useState([]);
  const [initialInputsLocked, setInitialInputsLocked] = useState(false);
  const inputRef = useRef([]);
  const [currentItem, setCurrentItem] = useState(emptyItem);
  const itemNameRef = useRef(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [addParticipantMode, setAddParticipantMode] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [closingMenu, setClosingMenu] = useState(null);
  const [tripId, setTripId] = useState(0);
  const [tripStarted, setTripStarted] = useState(false);
  const [tripDefaultsEditable, setTripDefaultsEditable] = useState(true);
  const [activeTripEntering, setActiveTripEntering] = useState(false);
  const [activeTripClosing, setActiveTripClosing] = useState(false);
  const [isSavingTrip, setIsSavingTrip] = useState(false);
  const [newlySavedTripId, setNewlySavedTripId] = useState(null);
  const [editingTripId, setEditingTripId] = useState(null);
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [newlyAddedItemIndex, setNewlyAddedItemIndex] = useState(null);
  const [shoppingTrip, setShoppingTrip] = useState({
      id: tripId,
      date: new Date().toISOString().split("T")[0],
      store: 'lidl',
      participants: initialInputs.length > 0 ? [...initialInputs] : [],
      defaultPayer: initialInputs.length > 0 ? initialInputs[0] : '',
      defaultSplit: {
        type: 'all',
        between: initialInputs ? [...initialInputs] : [],
      },
      items: [],
    });
  const [shoppingTrips, setShoppingTrips] = useState([]);
  const safeInitialInputs = Array.isArray(initialInputs) ? initialInputs : [];

  useEffect(() => {
    const isMountedRef = { current: true };
    const timerId = setTimeout(() => {
      (async () => {
        try {
          const response = await api.get('/participants');
          const tripResponse = await api.get('/trips');

          if (response.status === 200 && isMountedRef.current) {
            console.log('Participants fetched successfully:', response.data);
            const fetchedParticipants = Array.isArray(response.data?.participants)
              ? response.data.participants
              : [];
            setInitialInputs(fetchedParticipants);
            setParticipants(
              fetchedParticipants.map((name, index) => ({
                name,
                theme: themes[index % themes.length],
              }))
            );
            setShoppingTrip((previousTrip) => ({
              ...previousTrip,
              participants: [...fetchedParticipants],
              defaultPayer: fetchedParticipants[0] || '',
              defaultSplit: {
                ...previousTrip.defaultSplit,
                between: [...fetchedParticipants],
              },
            }));
            setInitialInputsLocked(
              fetchedParticipants.length > 0 &&
              fetchedParticipants.every((name) => String(name).trim() !== "")
            );
            setShoppingTrips(Array.isArray(tripResponse.data.trips) ? tripResponse.data.trips : []);
          }
        } catch (error) {
          console.error('Error fetching participants:', error);
        }
      })();
    }
    , 0);

    return () => {
      clearTimeout(timerId);
      isMountedRef.current = false;
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
      items: Array.isArray(trip.items) ? trip.items.map((item) => ({
        ...item,
        splitBetween: Array.isArray(item.splitBetween) ? [...item.splitBetween] : [],
      })) : [],
    });
    setEditingTripId(trip.dbTripId);
    setEditingItemIndex(null);
    setTripDefaultsEditable(false);
    setTripStarted(true);
    animateActiveTripEntry();
  };

  const deleteTrip = async (trip) => {
    if (!Number.isInteger(trip.dbTripId)) {
      return;
    }

    try {
      const response = await api.delete(`/trip/${trip.dbTripId}`);
      if (response.status === 200) {
        setShoppingTrips((trips) => trips.filter((savedTrip) => savedTrip.dbTripId !== trip.dbTripId));
      }
    } catch (error) {
      console.error('Error deleting trip:', error);
    }
  };

  const deleteActiveTrip = async () => {
    if (Number.isInteger(editingTripId)) {
      await deleteTrip({ dbTripId: editingTripId });
    }

    setTripStarted(false);
    setTripDefaultsEditable(true);
    setEditingTripId(null);
    setEditingItemIndex(null);
  };

  const closeActiveTrip = async () => {
    if (!Number.isInteger(editingTripId) || activeTripClosing) {
      return;
    }

    try {
      const response = await api.put(`/trip/${editingTripId}`, shoppingTrip);
      if (response.status !== 200) {
        return;
      }

      const tripsResponse = await api.get('/trips');
      if (tripsResponse.status === 200) {
        setShoppingTrips(Array.isArray(tripsResponse.data?.trips) ? tripsResponse.data.trips : []);
      }

      setActiveTripClosing(true);
      setTimeout(() => {
        setShoppingTrip({
          id: tripId,
          date: new Date().toISOString().split("T")[0],
          store: 'lidl',
          participants: [...safeInitialInputs],
          defaultPayer: safeInitialInputs[0] || '',
          defaultSplit: {
            type: 'all',
            between: [...safeInitialInputs],
          },
          items: [],
        });
        setTripStarted(false);
        setTripDefaultsEditable(true);
        setEditingTripId(null);
        setEditingItemIndex(null);
        setActiveTripClosing(false);
      }, 250);
    } catch (error) {
      console.error('Error saving edited bill:', error);
    }
  };

  const deleteActiveItem = (itemIndex) => {
    setShoppingTrip((trip) => ({
      ...trip,
      items: trip.items.filter((_, index) => index !== itemIndex),
    }));
    setEditingItemIndex((currentIndex) => {
      if (currentIndex === itemIndex) {
        return null;
      }
      return currentIndex !== null && currentIndex > itemIndex ? currentIndex - 1 : currentIndex;
    });
  };

  const highlightAddedItem = (itemIndex) => {
    setNewlyAddedItemIndex(itemIndex);
    setTimeout(() => setNewlyAddedItemIndex(null), 350);
  };

  const highlightSavedTrip = (tripId) => {
    setNewlySavedTripId(tripId);
    setTimeout(() => setNewlySavedTripId(null), 450);
  };

  const animateActiveTripEntry = () => {
    setActiveTripEntering(true);
    setTimeout(() => setActiveTripEntering(false), 300);
  };

  const participantCount = safeInitialInputs.filter((name) => String(name).trim()).length;
  const participantsPanelVisible = !initialInputsLocked || activeMenu === 'participants' || closingMenu === 'participants';
  const billsPanelVisible = activeMenu === 'bills' || closingMenu === 'bills';
  const menuPanelOpen = !initialInputsLocked || activeMenu !== null || closingMenu !== null;

  const toggleParticipantsMenu = () => {
    if (activeMenu === 'participants' && initialInputsLocked) {
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
        <p>Kitchen Split</p>
      </div>
      <div className={`kitchen-split-body${menuPanelOpen ? ' menu-panel-open' : ''}${participantsPanelVisible ? ' participants-menu-open' : ''}`}>
        <nav className="kitchen-split-menu" aria-label="Kitchen Split menu">
          <button
            className={`kitchen-menu-button${activeMenu === 'participants' || !initialInputsLocked ? ' kitchen-menu-button-active' : ''}`}
            type="button"
            title="Show participants"
            aria-label="Show participants"
            aria-pressed={activeMenu === 'participants'}
            onClick={toggleParticipantsMenu}
          >
            <FaUsers aria-hidden="true" />
            <span className="kitchen-menu-count">{participantCount}</span>
          </button>
          <button
            className={`kitchen-menu-button${activeMenu === 'bills' ? ' kitchen-menu-button-active' : ''}`}
            type="button"
            title="Show recent bills"
            aria-label="Show recent bills"
            aria-pressed={activeMenu === 'bills'}
            onClick={toggleBillsMenu}
          >
            <FaReceipt aria-hidden="true" />
            <span className="kitchen-menu-count">{shoppingTrips.length}</span>
          </button>
        </nav>

        {menuPanelOpen && (
        <aside className={`kitchen-split-menu-panel${participantsPanelVisible ? ' participants-menu-panel' : ''}${closingMenu === 'participants' ? ' participants-menu-panel-closing' : ''}${billsPanelVisible ? ' bills-menu-panel' : ''}${closingMenu === 'bills' ? ' bills-menu-panel-closing' : ''}`}>
          {participantsPanelVisible && (
          <Participants
            splitBetween={splitBetween}
            setSplitBetween={setSplitBetween}
            initialInputs={initialInputs}
            setInitialInputs={setInitialInputs}
            initialInputsLocked={initialInputsLocked}
            setInitialInputsLocked={setInitialInputsLocked}
            setParticipants={setParticipants}
            inputRef={inputRef}
            itemNameRef={itemNameRef}
            onAddParticipantModeChange={(mode) => {
              setAddParticipantMode(mode);
              if (mode) {
                setActiveMenu('participants');
              }
            }}
            isMenuOpen
            showMenuToggle={false}
          />
          )}
          {initialInputsLocked && billsPanelVisible && (
            <RecentTrips
              participants={participants}
              shoppingTrips={shoppingTrips}
              newlySavedTripId={newlySavedTripId}
              onEditTrip={editTrip}
              onDeleteTrip={deleteTrip}
              isMenuOpen
              showMenuToggle={false}
            />
          )}
        </aside>
        )}

        <div className="kitchen-split-content">
          {initialInputsLocked && (
            <TripManager
              initialInputs={safeInitialInputs}
              emptyItem={emptyItem}
              currentItem={currentItem}
              setCurrentItem={setCurrentItem}
              selectedItemIndex={selectedItemIndex}
              setSelectedItemIndex={setSelectedItemIndex}
              itemNameRef={itemNameRef}
              participants={participants}
              shoppingTrip={shoppingTrip}
              tripId={tripId}
              setTripId={setTripId}
              setShoppingTrip={setShoppingTrip}
              shoppingTrips={shoppingTrips}
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
          {initialInputsLocked && (tripStarted || shoppingTrips.length > 0) && (
            <ItemCards
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
          <div className="settlement-results">
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualSplit;
