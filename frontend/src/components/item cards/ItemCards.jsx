import { useState } from 'react';
import api from '../../api.js';
import {
  FaStore,
  FaCalendarDays,
  FaUsers,
  FaCartShopping,
  FaMoneyBillWave,
  FaPen,
  FaTrash,
  FaXmark,
} from 'react-icons/fa6';
import './ItemCards.css';

export const ItemCards = ({
  kitchenId,
  selectedItemIndex,
  setSelectedItemIndex,
  setCurrentItem,
  itemNameRef,
  participants,
  shoppingTrips,
  setShoppingTrips,
  activeTrip,
  activeTripEntering,
  activeTripClosing,
  isSavingTrip,
  newlyAddedItemIndex,
  showSavedTrips = true,
  onEditActiveItem,
  onDeleteActiveItem,
  onDeleteActiveTrip,
  onEditActiveTrip,
  isEditingActiveTrip,
  onCloseActiveTrip,
}) => {
  const [hoveredTripId, setHoveredTripId] = useState(null);
  const [activeTripActionsVisible, setActiveTripActionsVisible] = useState(false);
  const trips = Array.isArray(shoppingTrips) ? shoppingTrips : [];

  const resolveTripId = (trip) => {
    if (Number.isInteger(trip?.dbTripId)) return trip.dbTripId;
    if (Number.isInteger(trip?.id)) return trip.id;
    return null;
  };

  const handleDeleteTrip = async (tripDbId) => {
    const tripToDelete = trips.find((trip) => resolveTripId(trip) === tripDbId);
    if (!tripToDelete || !Number.isInteger(tripDbId)) {
      return;
    }

    try {
      const response = await api.delete(`/kitchens/${kitchenId}/bills/${tripDbId}`);
      if (response.status === 200) {
        const updatedTrips = trips.filter((trip) => resolveTripId(trip) !== tripDbId);
        setSelectedItemIndex((prevTripId) => {
          if (prevTripId === tripDbId) {
            setCurrentItem({ name: '', price: '', paidBy: '', splitType: '', splitBetween: [] });
            return null;
          }
          return prevTripId;
        });
        setHoveredTripId((prevTripId) => (prevTripId === tripDbId ? null : prevTripId));
        setShoppingTrips(updatedTrips);
      }
    } catch {
      // ignore and keep current state
    }
  };

  return (
    <div className={`saved-trips-container${activeTrip ? ' active-trip-list' : ''}`}>
      {activeTrip && (() => {
        const activePayer = participants.find((participant) => participant.name === activeTrip.defaultPayer);
        const activeItems = Array.isArray(activeTrip.items) ? activeTrip.items : [];
        const activeTripTotal = activeItems.reduce((total, item) => total + (Number(item.price) || 0), 0);
        return (
          <div
            className={`saved-trip-container active-trip-container${activeTripActionsVisible ? ' active-trip-selected' : ''}${activeTripEntering ? ' active-trip-entering' : ''}${activeTripClosing ? ' active-trip-closing' : ''}${isSavingTrip ? ' active-trip-saving' : ''}`}
            style={{
              '--primary': activePayer?.theme.primary,
              '--background': activePayer?.theme.background,
              '--border': activePayer?.theme.border,
              '--shadow': activePayer?.theme.shadow,
            }}
            onClick={() => setActiveTripActionsVisible((isVisible) => !isVisible)}
          >
            {isEditingActiveTrip && (
              <button className="active-trip-close" type="button" disabled={activeTripClosing} title="Close bill" aria-label="Close bill" onClick={(event) => {
                event.stopPropagation();
                setActiveTripActionsVisible(false);
                onCloseActiveTrip?.();
              }}>
                <FaXmark aria-hidden="true" />
              </button>
            )}
            <div className="trip-header">
              <div className="trip-date"><FaCalendarDays className="trip-icon" /><p>{activeTrip.date}</p></div>
              <div className="trip-store"><FaStore className="trip-icon" /><p>{activeTrip.store}</p></div>
              <div className="trip-payer" title={`Paid by ${activeTrip.defaultPayer}`}>
                <FaMoneyBillWave className="trip-icon" aria-hidden="true" />
                <div className="saved-participant" style={{ '--participant-color': activePayer?.theme.primary }}>
                  {activeTrip.defaultPayer.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
            <p className="active-trip-status">Total: {`£${activeTripTotal.toFixed(2)}`}</p>
            <div className="saved-trip-content">
              <div className="saved-trip-items">
                <span className="active-trip-cart"><FaCartShopping className="trip-icon" /><span className="active-trip-item-count">{activeItems.length}</span></span>
                {activeItems.length === 0 ? <span className="empty-trip-items">No items added yet</span> : activeItems.map((item, itemIndex) => (
                  <div className={`saved-item-content${newlyAddedItemIndex === itemIndex ? ' saved-item-new' : ''}`} key={`${item.name}-${itemIndex}`}>
                    <span className="saved-item-name">{item.name}</span>
                    <span className="saved-item-price">{`£${item.price}`}</span>
                    <div className="saved-item-actions">
                      <button type="button" title={`Edit ${item.name}`} aria-label={`Edit ${item.name}`} onClick={() => onEditActiveItem?.(itemIndex)}><FaPen aria-hidden="true" /></button>
                      <button type="button" title={`Delete ${item.name}`} aria-label={`Delete ${item.name}`} onClick={() => onDeleteActiveItem?.(itemIndex)}><FaTrash aria-hidden="true" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="saved-trip-participants">
              <FaUsers className="trip-icon" />
              {activeTrip.participants.map((participantName) => (
                <div key={participantName} className="saved-participant" title={participantName} aria-label={participantName} style={{ '--participant-color': participants.find((participant) => participant.name === participantName)?.theme.primary }}>
                  {participantName.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
            <div className="active-trip-actions">
              <button type="button" title="Edit trip defaults" aria-label="Edit trip defaults" onClick={(event) => {
                event.stopPropagation();
                setActiveTripActionsVisible(false);
                onEditActiveTrip?.();
              }}><FaPen aria-hidden="true" /><span>Edit</span></button>
              <button type="button" title="Delete active trip" aria-label="Delete active trip" onClick={(event) => {
                event.stopPropagation();
                setActiveTripActionsVisible(false);
                onDeleteActiveTrip?.();
              }}><FaTrash aria-hidden="true" /><span>Delete</span></button>
            </div>
          </div>
        );
      })()}
      {showSavedTrips && trips.map((trip, index) => {
        const participant = participants.find((person) => person.name === trip.defaultPayer);
        const tripParticipants = Array.isArray(trip.participants) ? trip.participants : [];
        const tripItems = Array.isArray(trip.items) ? trip.items : [];
        const tripDbId = resolveTripId(trip);
        return (
          <div
            key={tripDbId ?? index}
            className={`saved-trip-container ${selectedItemIndex === tripDbId && hoveredTripId === tripDbId ? 'selected-trip-highlight' : ''}`}
            style={{
              '--primary': participant?.theme.primary,
              '--background': participant?.theme.background,
              '--border': participant?.theme.border,
              '--shadow': participant?.theme.shadow,
            }}
            onMouseEnter={() => {
              if (tripDbId !== null) {
                setHoveredTripId(tripDbId);
                setSelectedItemIndex(tripDbId);
              }
            }}
            onMouseLeave={() => setHoveredTripId(null)}
          >
            <div className="trip-header">
              <div className="trip-date"><FaCalendarDays className="trip-icon" /><p>{trip.date}</p></div>
              <div className="trip-store"><FaStore className="trip-icon" /><p>{trip.store}</p></div>
              <div className="trip-payer" title={`Paid by ${trip.defaultPayer}`}>
                <FaMoneyBillWave className="trip-icon" aria-hidden="true" />
                <div className="saved-participant" style={{ '--participant-color': participant?.theme.primary }}>{trip.defaultPayer.charAt(0).toUpperCase()}</div>
              </div>
            </div>
            <div className="saved-trip-content">
              <div className="saved-trip-items">
                <FaCartShopping className="trip-icon" />
                {tripItems.map((item, itemIndex) => (
                  <div key={itemIndex} className="saved-item-content" onClick={() => {
                    if (tripDbId !== null) {
                      setSelectedItemIndex(tripDbId);
                    }
                    setCurrentItem({ ...item, splitBetween: Array.isArray(item.splitBetween) ? [...item.splitBetween] : [] });
                    itemNameRef.current?.focus?.();
                  }}>
                    <a className="saved-item-name">{item.name}</a>
                    <a className="saved-item-price">{`£${item.price}`}</a>
                  </div>
                ))}
              </div>
            </div>
            <div className="saved-trip-participants">
              <FaUsers className="trip-icon" />
              {tripParticipants.map((participantName, participantIndex) => (
                <div key={participantIndex} className="saved-participant" title={participantName} aria-label={participantName} style={{ '--participant-color': participants.find((person) => person.name === participantName)?.theme.primary }}>
                  {participantName.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
            {hoveredTripId === tripDbId && (
              <div className="saved-trip-buttons">
                <button className="delete-button" disabled={tripDbId === null} onClick={() => handleDeleteTrip(tripDbId)}>Delete</button>
                <button className="edit-button" onClick={() => {
                  const firstItem = tripItems[0];
                  if (!firstItem) {
                    return;
                  }
                  if (tripDbId !== null) {
                    setSelectedItemIndex(tripDbId);
                  }
                  setCurrentItem({ ...firstItem, splitBetween: Array.isArray(firstItem.splitBetween) ? [...firstItem.splitBetween] : [] });
                  itemNameRef.current?.focus?.();
                }}>Edit</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
