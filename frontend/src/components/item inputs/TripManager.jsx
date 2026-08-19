import {useState} from 'react';
import { ItemManager } from './ItemManager.jsx';
import api from '../../api.js';
import './ItemInputs.css';


export const TripManager = ({initialInputs, itemNameRef, shoppingTrip, setShoppingTrip, setShoppingTrips, setTripStarted, tripStarted, tripDefaultsEditable, setTripDefaultsEditable, isSavingTrip, setIsSavingTrip, onTripSaved, onItemAdded, onTripStarted, editingTripId, setEditingTripId, editingItemIndex, setEditingItemIndex}) => {
    const [tripCount, setTripCount] = useState(1);
    const [settlementResults, setSettlementResults] = useState(null);
    const [customSplitParticipants, setCustomSplitParticipants] = useState(false);
    const [startTripEntering, setStartTripEntering] = useState(false);
    const [isStartingTrip, setIsStartingTrip] = useState(false);
    const [itemInputsEntering, setItemInputsEntering] = useState(false);

    const submitTrip = async () => {
      try {
        const response = editingTripId
          ? await api.put(`/trip/${editingTripId}`, shoppingTrip)
          : await api.post('/trip', shoppingTrip);
        if (response.status === 200) {
          console.log('Trip submitted successfully:', response.data);
          setSettlementResults(response.data.settlementResults);
          return response.data;
        }
      } catch (error) {
        console.error('Error submitting trip:', error);
      }
      return null;
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
    const handleItem = (item, itemIndex) => {
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
      setShoppingTrip((prev) => {
        const items = [...prev.items];
        if (itemIndex !== null) {
          items[itemIndex] = normalizedItem;
        } else {
          items.push(normalizedItem);
          onItemAdded?.(items.length - 1);
        }
        return {...prev, items};
      });
      setEditingItemIndex(null);
    }

    const handleSaveBill = async () => {
      const savedTrip = await submitTrip();
      if (!savedTrip) {
        setSettlementResults('Unable to save this trip. Please try again.');
        return;
      }

      setIsSavingTrip(true);
      await new Promise((resolve) => setTimeout(resolve, 250));
      setTripCount((prev) => prev + 1);
      await getTrips();
      onTripSaved?.(savedTrip.tripId);
      setCustomSplitParticipants(false);
      setShoppingTrip({
        id: tripCount + 1,
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
      setStartTripEntering(true);
      setTripStarted(false);
      setTripDefaultsEditable(true);
      setEditingTripId(null);
      setEditingItemIndex(null);
      setSettlementResults(null);
      setIsSavingTrip(false);
      setTimeout(() => setStartTripEntering(false), 250);
    };

  return (
    <div>
      {tripCount > 0 && (
        <div className="shopping-trip-container">
          <div className="shopping-defaults">
            <div className="shopping-default-fields">
              <label className="shopping-default-field">
                <span>Date</span>
                <input
                  type="date"
                  value={shoppingTrip.date}
                  disabled={tripStarted && !tripDefaultsEditable}
                  onChange={(e) => {
                    setShoppingTrip((prev) => ({...prev, date: e.target.value}));
                  }}
                />
              </label>
              <label className="shopping-default-field">
                <span>Store</span>
                <select
                  value={shoppingTrip.store}
                  disabled={tripStarted && !tripDefaultsEditable}
                  onChange={(e) => {
                    setShoppingTrip((prev) => ({...prev, store: e.target.value}));
                  }}
                >
                  <option value="">Select Store</option>
                  <option value="lidl">lidl</option>
                  <option value="Amma">Amma</option>
                  <option value="Tesco">Tesco</option>
                  <option value="Sainsbury's">Sainsbury's</option>
                  <option value="Electricity">Electricity</option>
                  <option value="Aldi">Aldi</option>
                  <option value="Morrisons">Morrisons</option>
                  <option value="Waitrose">Waitrose</option>
                  <option value="Iceland">Iceland</option>
                  <option value="Asda">Asda</option>
                  <option value="Co-op">Co-op</option>
                  <option value="Marks & Spencer">Marks & Spencer</option>
                </select>
              </label>
              <label className="shopping-default-field">
                <span>Participants</span>
                <select
                  disabled={tripStarted && !tripDefaultsEditable}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "custom") {
                      setCustomSplitParticipants(true);
                    } else {
                      setCustomSplitParticipants(false);
                      setShoppingTrip((prev) => ({...prev, participants: value === "all" ? [...initialInputs] : []}));
                    }
                  }}
                  value={customSplitParticipants ? "custom" : "all"}
                >
                  <option value="">Select Participants</option>
                  <option value="all">All</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              {customSplitParticipants && (
              <label className="shopping-default-field">
                <span>Select participants</span>
              <select
                multiple
                className="item-split-between-select"
                value={shoppingTrip.participants}
                disabled={tripStarted && !tripDefaultsEditable}
                onChange={(e) => {
                  const selectedOptions = Array.from(e.target.selectedOptions, (option) => option.value);
                  setShoppingTrip((prev) => ({...prev, participants: selectedOptions}));
                }}
              >
                {initialInputs.map((person, idx) => (
                  <option key={idx} value={person}>{person}</option>
                ))}
              </select>
              </label>
              )}
              <label className="shopping-default-field">
                <span>Paid by</span>
                <select
                  className="item-paid-by-select"
                  value={shoppingTrip.defaultPayer}
                  disabled={tripStarted && !tripDefaultsEditable}
                  onChange={(e) => {
                    setShoppingTrip((prev) => ({...prev, defaultPayer: e.target.value}));
                  }}
                >
                  <option value="">Select Default Payer</option>
                  {shoppingTrip.participants.map((person, idx) => (
                    <option key={idx} value={person}>{person}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="trip-action-slot">
            {!tripStarted && (
            <button
              className={`lock-button${startTripEntering ? ' start-trip-entering' : ''}${isStartingTrip ? ' start-trip-exiting' : ''}`}
              disabled={isStartingTrip}
              onClick={async () => {
                if (!shoppingTrip.date || !shoppingTrip.store || shoppingTrip.participants.length === 0 || !shoppingTrip.defaultPayer || !shoppingTrip.defaultSplit.type) {
                  setSettlementResults("Please fill in all shopping trip details before saving defaults.");
                  return;
                } else if (shoppingTrip.date && shoppingTrip.store && shoppingTrip.participants.length > 0 && shoppingTrip.defaultPayer && shoppingTrip.defaultSplit.type) {
                  setIsStartingTrip(true);
                  await new Promise((resolve) => setTimeout(resolve, 250));
                  setSettlementResults(null);
                  setTripDefaultsEditable(false);
                  setTripStarted(true);
                  onTripStarted?.();
                  setItemInputsEntering(true);
                  setIsStartingTrip(false);
                  setTimeout(() => setItemInputsEntering(false), 300);
                }
              }}
              >Start Bill</button>
              )}
            </div>
          </div>
          <div className={`item-manager-transition${isSavingTrip ? ' item-manager-exiting' : ''}${itemInputsEntering ? ' item-manager-entering' : ''}`}>
            <ItemManager
              key={editingItemIndex ?? `new-item-${shoppingTrip.defaultPayer}-${shoppingTrip.defaultSplit.type}-${shoppingTrip.participants.join('|')}`}
              initialInputs={shoppingTrip.participants}
              saveDefaults={tripStarted}
              defaultPayer={shoppingTrip.defaultPayer}
              defaultSplitType={shoppingTrip.defaultSplit.type}
              tripParticipants={shoppingTrip.participants}
              itemNameRef={itemNameRef}
              handleItem={handleItem}
              editingItemIndex={editingItemIndex}
              initialItem={editingItemIndex !== null ? shoppingTrip.items[editingItemIndex] : null}
            />
          </div>
          {tripCount > 0 && tripStarted && (
            <div className="save-bill-action">
              <button
                className={`lock-button${isSavingTrip ? ' save-trip-exiting' : ''}`}
                disabled={isSavingTrip}
                onClick={handleSaveBill}
              >
                Save Bill
              </button>
            </div>
          )}
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