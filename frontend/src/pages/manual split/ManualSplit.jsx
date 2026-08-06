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
          }
        } catch (error) {
          console.error('Error fetching participants:', error);
        }
      })();
    }, 0);

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
      />)}

      {safeInitialInputs.length > 0 && safeInitialInputs.every((name) => String(name).trim() !== "") && !initialInputsLocked && (
        <button className="lock-button" onClick = {() => {
          setInitialInputsLocked(true);
          const participants = safeInitialInputs.map((name, index) => ({
            name,
            theme: themes[index % themes.length],
          }));
          setParticipants(participants);
          setTimeout(() => {
            itemNameRef.current?.focus();
          }, 0);
        }}>Lock Participants</button>
      )}

      {initialInputsLocked && (
        <div className = "locked-inputs">
        {safeInitialInputs.map((value, index) => (
          <div key={index}>
            <button 
            className="lock-button" 
            style={{
              "--primary": themes[index % themes.length].primary,
              "--background": themes[index % themes.length].background,
              "--border": themes[index % themes.length].border,
              "--shadow": themes[index % themes.length].shadow,
            }}
            onClick = {() => {setInitialInputsLocked(false)}}>{value}</button>
          </div>
        ))}
        <div>
          <button className="lock-button" onClick = {() => {
              setInitialInputsLocked(false);
              const newParticipants = [...safeInitialInputs, ""]; 
              setInitialInputs(newParticipants);
              setTimeout(() => {
                inputRef.current[newParticipants.length - 1]?.focus();
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
        {shoppingTrips.length > 0 && 
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
