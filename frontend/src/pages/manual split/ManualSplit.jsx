import {useState, useRef, useEffect} from 'react';
import {Participants} from '../../components/participants/Participants.jsx';
import {TripManager} from '../../components/item inputs/TripManager.jsx';
import { ItemCards } from '../../components/item cards/ItemCards.jsx';
import {themes} from '../../components/themes/themes.jsx';
import api from '../../api.js';
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
  const [tripId, setTripId] = useState(0);
  const [shoppingTrip, setShoppingTrip] = useState({
      id: tripId,
      date: new Date().toISOString().split("T")[0],
      store: '',
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


  return (
    <div className="kitchen-split-container">
      <div className="kitchen-split-header">
        <p>Kitchen Split</p>
      </div>
      <div className={`kitchen-split-body${initialInputsLocked ? ' participants-ready' : ''}${addParticipantMode ? ' add-participant-mode' : ''}`}>
        <div className="participants-container">
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
            onAddParticipantModeChange={setAddParticipantMode}
          />
        </div>

        {!addParticipantMode && (
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
            />
          )}
          {initialInputsLocked && shoppingTrips.length > 0 && (
            <ItemCards
              selectedItemIndex={selectedItemIndex}
              setSelectedItemIndex={setSelectedItemIndex}
              setCurrentItem={setCurrentItem}
              itemNameRef={itemNameRef}
              participants={participants}
              shoppingTrips={shoppingTrips}
              setShoppingTrips={setShoppingTrips}
            />
          )}
          <div className="settlement-results">
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default ManualSplit;
