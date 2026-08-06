import {useState, useEffect} from 'react';
import { ItemManager } from './ItemManager.jsx';
import api from '../../api.js';
import './ItemInputs.css';


export const TripManager = ({initialInputs, itemNameRef, shoppingTrip, setShoppingTrip, shoppingTrips, setShoppingTrips}) => {
    const [tripCount, setTripCount] = useState(1);
    const [showStartTripButton, setShowStartTripButton] = useState(true);
    const [settlementResults, setSettlementResults] = useState(null);
    const [saveDefaults, setSaveDefaults] = useState(false);
    const [customSplitParticipants, setCustomSplitParticipants] = useState(false);
    
    useEffect(() => {
      console.log('Shopping Trips:', shoppingTrips);
    }, [shoppingTrips]);

    const submitTrip = async () => {
      try {
        const response = await api.post('/trip', shoppingTrip);
        if (response.status === 200) {
          console.log('Trip submitted successfully:', response.data);
          setSettlementResults(response.data.settlementResults);
        }
      } catch (error) {
        console.error('Error submitting trip:', error);
      }
    };
    const getTrips = async () => {
      try {
        const response = await api.get('/trips');
        if (response.status === 200) {
          console.log('Trips fetched successfully:', response.data);
          setShoppingTrips(Array.isArray(response.data?.trips) ? response.data.trips : []);
        }
      } catch (error) {
        console.error('Error fetching trips:', error);
      }
    };
    const handleItem = (item) => {
      const splitType = item.splitType ? item.splitType.trim() : shoppingTrip.defaultSplit.type.trim();
      const paidBy = item.paidBy ? item.paidBy.trim() : shoppingTrip.defaultPayer.trim();
      const splitBetween = splitType === 'all'
        ? [...shoppingTrip.participants]
        : splitType === paidBy
          ? [paidBy]
          : Array.isArray(item.splitBetween) && item.splitBetween.length > 0
            ? [...item.splitBetween]
            : [...shoppingTrip.defaultSplit.between];

      const normalizedItem = {
        ...item,
        name: item.name.trim(),
        price: Number(item.price),
        paidBy,
        splitType,
        splitBetween,
      };
      setShoppingTrip((prev) => ({
        ...prev,
        items: [...prev.items, normalizedItem],
      }));
    }

  return (
    <div>
      {tripCount > 0 && (
        <div className="shopping-trip-container">
          <div className="shopping-defaults">
            <div>
            <input type="date" 
            onChange={(e) => {
              setShoppingTrip((prev) => ({...prev, date: e.target.value}));
            }}            
            />
            <select
            onChange={(e) => {
              setShoppingTrip((prev) => ({...prev, store: e.target.value}));
            }}
            >
              <option value="">Select Store</option>
              <option value="lidl">lidl</option>
              <option value="Amma">Amma</option>
              <option value="Tesco">Tesco</option>
              <option value="Sainsbury's">Sainsbury's</option>
              <option value="Aldi">Aldi</option>
              <option value="Morrisons">Morrisons</option>
              <option value="Waitrose">Waitrose</option>
              <option value="Iceland">Iceland</option>
              <option value="Asda">Asda</option>
              <option value="Co-op">Co-op</option>
              <option value="Marks & Spencer">Marks & Spencer</option>  
            </select>
            <select 
            onChange={(e) => {
              const value = e.target.value;
              if (value === "custom") {
                setCustomSplitParticipants(true);
              } else {
                setCustomSplitParticipants(false);
                setShoppingTrip((prev) => ({...prev, participants: value === "all" ? [...initialInputs] : []}));
              } 
            }}>
              <option value="">Select Participants</option>
              <option value="all">All</option>
              <option value="custom">Custom</option>
            </select>
            {customSplitParticipants && (
              <select
                multiple
                className="item-split-between-select"
                value={shoppingTrip.participants}
                onChange={(e) => {
                  const selectedOptions = Array.from(e.target.selectedOptions, (option) => option.value);
                  setShoppingTrip((prev) => ({...prev, participants: selectedOptions}));
                }}
              >
                {initialInputs.map((person, idx) => (
                  <option key={idx} value={person}>{person}</option>
                ))}
              </select>
            )}
            <select
              className="item-paid-by-select"
              value={shoppingTrip.defaultPayer}
              onChange={(e) => {
                setShoppingTrip((prev) => ({...prev, defaultPayer: e.target.value}));
              }}
            >
              <option value="">Select Default Payer</option>
              {shoppingTrip.participants.map((person, idx) => (
                <option key={idx} value={person}>{person}</option>
              ))}
            </select>
            </div>
            <div>
            {showStartTripButton && (
            <button
              className="lock-button"
              onClick={() => {
                if (!shoppingTrip.date || !shoppingTrip.store || shoppingTrip.participants.length === 0 || !shoppingTrip.defaultPayer || !shoppingTrip.defaultSplit.type) {
                  setSettlementResults("Please fill in all shopping trip details before saving defaults.");
                  return;
                } else if (shoppingTrip.date && shoppingTrip.store && shoppingTrip.participants.length > 0 && shoppingTrip.defaultPayer && shoppingTrip.defaultSplit.type) {
                  setSaveDefaults(prev => !prev);
                  setSettlementResults(null);
                  setShowStartTripButton(false);
                }
              }}
              >Start shopping trip</button>
              )}
            {tripCount > 0 && !showStartTripButton && (
            <button
            className="lock-button"
            onClick={() => {
              setTripCount((prev) => prev + 1);
              submitTrip();
              getTrips();
              setShoppingTrip({
                id: tripCount + 1,
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
              setShowStartTripButton(true);
              setSettlementResults(null);
            }}
            >
            {"Next Trip"}
            </button>
            )}
            </div>
          </div>
          <ItemManager
            initialInputs={shoppingTrip.participants}
            saveDefaults={saveDefaults}
            defaultPayer={shoppingTrip.defaultPayer}
            defaultSplitType={shoppingTrip.defaultSplit.type}
            tripParticipants={shoppingTrip.participants}
            itemNameRef={itemNameRef}
            handleItem={handleItem}
          />
        </div>
      )}
      {settlementResults && (
        <div className="settlement-results">
          {Array.isArray(settlementResults) ? (
            settlementResults.map((result, index) => (
              <p key={index}>
                {result?.from && result?.to && result?.amount !== undefined
                  ? `${result.from} pays ${result.to}: £${Number(result.amount).toFixed(2)}`
                  : String(result)}
              </p>
            ))
          ) : (
            <p>{settlementResults}</p>
          )}
        </div>
      )}
    </div>
  );
};