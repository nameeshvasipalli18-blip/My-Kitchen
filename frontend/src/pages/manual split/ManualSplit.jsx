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
  const [lockButtonTheme, setLockButtonTheme] = useState([]);
  const [tripId, setTripId] = useState(0);
  const [newParticipant, setNewParticipant] = useState(false);
  const [changedParticipants, setChangedParticipants] = useState(false);
  const [participantIndex, setParticipantIndex] = useState(null);
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

  const newparticipantSubmit = async () => {
    const participantName = String(safeInitialInputs[safeInitialInputs.length - 1] ?? "").trim();
    if (!participantName) {
      return;
    }

    try {
      const response = await api.post('/newParticipant', { name: participantName });
      if (response.status === 200) {
        console.log('New participant submitted successfully:', response.data);
        setNewParticipant(false);
      }
    }
    catch (error) {
      console.error('Error submitting new participant:', error);
    }
  };


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
    <div className = "manual-split-container">
      {!initialInputsLocked && (
      <Participants
        splitBetween={splitBetween}
        setSplitBetween={setSplitBetween}
        initialInputs={initialInputs}
        setInitialInputs={setInitialInputs}
        initialInputsLocked={initialInputsLocked}
        setInitialInputsLocked={setInitialInputsLocked}
        participants={participants}
        setParticipants={setParticipants}
        lockButtonTheme={lockButtonTheme}
        setLockButtonTheme={setLockButtonTheme}
        inputRef={inputRef}
        itemNameRef={itemNameRef}
      />
      )}

      {safeInitialInputs.length > 0 && safeInitialInputs.every((name) => String(name).trim() !== "") && !initialInputsLocked && (
        <button className="lock-button" onClick = {() => {
          setInitialInputsLocked(true);
          const participants = safeInitialInputs.map((name, index) => ({
            name,
            theme: themes[index % themes.length],
          }));
          setParticipants(participants);
          if (newParticipant) {
            newparticipantSubmit();
          }
          setTimeout(() => {
            itemNameRef.current?.focus();
          }, 0);
        }}>Lock Participants</button>
      )}

      {initialInputsLocked && (
        <div className = "locked-inputs">
        {initialInputs.map((value, index) => (
          <div key={index}>
            <button 
            className="lock-button" 
            style={{
              "--primary": themes[index % themes.length].primary,
              "--background": themes[index % themes.length].background,
              "--border": themes[index % themes.length].border,
              "--shadow": themes[index % themes.length].shadow,
            }}
            onClick = {() => {
              setChangedParticipants(true);
              setParticipantIndex(index+1);
            }}
            >
              {value}
            </button>
          </div>
        ))}
        <div>
          {changedParticipants && participantIndex !== null && (
            <div className="participant-edit">
              <button className="lock-button" style={{
                "--primary": themes[(participantIndex - 1) % themes.length].primary,
                "--background": themes[(participantIndex - 1) % themes.length].background,
                "--border": themes[(participantIndex - 1) % themes.length].border,
                "--shadow": themes[(participantIndex - 1) % themes.length].shadow,
              }}
                onClick={async () => {
                  const deletedParticipant = await api.delete(`/deleteParticipant/${participantIndex}`);
                  if (deletedParticipant.status === 200) {
                    console.log('Participant deleted successfully:', deletedParticipant.data);
                    await api.get('/participants').then((response) => {
                      if (response.status === 200) {
                        const updatedParticipants = Array.isArray(response.data?.participants)
                          ? response.data.participants
                          : [];
                        setInitialInputs(updatedParticipants);
                        setParticipants(
                          updatedParticipants.map((name, index) => ({
                            name,
                            theme: themes[index % themes.length],
                          }))
                        );
                        setChangedParticipants(prev => !prev);
                        setParticipantIndex(null);
                      }
                    });
                  } 
                }}
                  >
                {`Delete ${initialInputs[participantIndex - 1]}`}
              </button>
            </div>
            )}
          <button className="lock-button" onClick = {() => {
              setInitialInputsLocked(false);
              setNewParticipant(true);
              setInitialInputs((prev) => [...prev, ""]);
              setParticipants((prev) => [...prev, {
                name: "",
                theme: themes[prev.length % themes.length],
              }]);
              setTimeout(() => {
                inputRef.current[initialInputs.length]?.focus();
              }, 0);
            }}>+</button>
          </div>
        </div>
      )}
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
      )
        }
        {initialInputsLocked && shoppingTrips.length > 0 && 
          <ItemCards
            selectedItemIndex={selectedItemIndex}
            setSelectedItemIndex={setSelectedItemIndex}
            setCurrentItem={setCurrentItem}
            itemNameRef={itemNameRef}
            participants={participants}
            shoppingTrips={shoppingTrips}
            setShoppingTrips={setShoppingTrips}
          />
  }
  <div className="settlement-results">
  </div>
    </div>
  );
};

export default ManualSplit;
