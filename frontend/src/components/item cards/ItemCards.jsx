import {useState} from "react";
import api from '../../api.js';
import {
  FaStore,
  FaUserCheck,
  FaCalendarDays,
  FaUsers,
  FaCartShopping
} from "react-icons/fa6";
import './ItemCards.css';
export const ItemCards = ({selectedItemIndex, setSelectedItemIndex, setCurrentItem, itemNameRef, participants, shoppingTrips, setShoppingTrips}) => {
  const [hoveredTripId, setHoveredTripId] = useState(null);
  const trips = Array.isArray(shoppingTrips) ? shoppingTrips : [];

  const resolveTripId = (trip) => {
    if (Number.isInteger(trip?.dbTripId)) return trip.dbTripId;
    if (Number.isInteger(trip?.id)) return trip.id;
    return null;
  };


  const handleDeleteTrip = async (tripDbId) => {
    const tripToDelete = trips.find((trip) => resolveTripId(trip) === tripDbId);
    if (!tripToDelete) {
      console.error('Trip not found for deletion:', tripDbId);
      return;
    }

    const deleteId = resolveTripId(tripToDelete);
    if (!Number.isInteger(deleteId)) {
      console.error('Unable to resolve trip id for deletion:', tripToDelete);
      return;
    }

    try {
      const response = await api.delete(`/trip/${deleteId}`);
      if (response.status === 200) {
        console.log('Trip deleted successfully:', response.data);
        const updatedTrips = trips.filter((trip) => resolveTripId(trip) !== tripDbId);
        setSelectedItemIndex((prevTripId) => {
          if (prevTripId === tripDbId) {
            setCurrentItem({
              name: "",
              price: "",
              paidBy: "",
              splitType: "",
              splitBetween: []
            });
            return null;
          }
          return prevTripId;
        });
        setHoveredTripId((prevTripId) => (prevTripId === tripDbId ? null : prevTripId));
        setShoppingTrips(updatedTrips);
      } else {
        console.error('Failed to delete trip:', response.status, response.data);
      }
    } catch (error) {
      console.error('Error deleting trip:', error);
    }
  };
    
    return (
      <div className="saved-trips-container">
        {trips.map((trip, index) => {
          const participant = participants.find(p => p.name === trip.defaultPayer);
          const tripParticipants = Array.isArray(trip.participants) ? trip.participants : [];
          const tripItems = Array.isArray(trip.items) ? trip.items : [];
          const tripDbId = resolveTripId(trip);
          return (
            <div key={tripDbId ?? index} 
              className={`saved-trip-container ${selectedItemIndex === tripDbId && hoveredTripId === tripDbId ? 'selected-trip-highlight' : ""}`}
              style={{
                "--primary": participant?.theme.primary,
                "--background": participant?.theme.background,
                "--border": participant?.theme.border,
                "--shadow": participant?.theme.shadow,
              }}
              onMouseEnter={() => {
                if (tripDbId !== null) {
                  setHoveredTripId(tripDbId);
                  setSelectedItemIndex(tripDbId);
                }
              }}
              onMouseLeave={() => {
                setHoveredTripId(null);
              }}
            >
            <div className="trip-header">
              <div className = "trip-date">
                <FaCalendarDays className="trip-icon" />
                <p>{trip.date}</p>
              </div>
              <div className = "trip-store">
                <FaStore className="trip-icon" />
                <p>{trip.store}</p>
              </div>
            </div>
            <div className="saved-trip-content">
              <div className="saved-trip-items">
                <FaCartShopping className="trip-icon" />
                {tripItems.map((item, itemIndex) => (
                  <div className="saved-item-content"
                    key={itemIndex}
                    onClick={() => {
                      if (tripDbId !== null) {
                        setSelectedItemIndex(tripDbId);
                      }
                      setCurrentItem({
                        ...item,
                        splitBetween: Array.isArray(item.splitBetween) ? [...item.splitBetween] : []
                      });
                      itemNameRef.current[0]?.focus();
                    }}
                  >
                    <a className="saved-item-name">{item.name}</a>
                    <a className="saved-item-price">{`£${item.price}`}</a>
                    {/* <a className="saved-item-paid-by">{item.paidBy}</a> */}
                  </div>
                ))}
              </div>
            </div>
              <div className="saved-trip-participants">
                <FaUsers className="trip-icon" />
                {tripParticipants.map((participant, participantIndex) => (
                  <div key={participantIndex} className="saved-participant">
                    <FaUserCheck className="participant-icon" />
                    <p>{participant.name}</p>
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
                      setCurrentItem({
                        ...firstItem,
                        splitBetween: Array.isArray(firstItem.splitBetween) ? [...firstItem.splitBetween] : []
                      });
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