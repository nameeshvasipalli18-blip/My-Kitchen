import { FaPen, FaTrash } from 'react-icons/fa6';
import './RecentTrips.css';

export const RecentTrips = ({ participants, shoppingTrips, newlySavedTripId, onEditTrip, onDeleteTrip }) => {
  const trips = Array.isArray(shoppingTrips) ? shoppingTrips : [];
  const formatDate = (date) => {
    const [year, month, day] = String(date || '').split('-').map(Number);
    if (!year || !month || !day) {
      return date || '';
    }

    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(year, month - 1, day));
  };

  return (
    <aside className="recent-trips-container" aria-label="Recent trips">
      <h2>Recent trips</h2>
      {trips.length === 0 ? (
        <p className="recent-trips-empty">No saved trips yet.</p>
      ) : (
        <div className="recent-trips-list">
          <div className="recent-trips-header" aria-hidden="true">
            <span>Date</span>
            <span>Store</span>
            <span>Total</span>
            <span>Paid by</span>
          </div>
          {[...trips].reverse().map((trip, index) => {
            const payer = participants.find((participant) => participant.name === trip.defaultPayer);
            const total = (Array.isArray(trip.items) ? trip.items : []).reduce(
              (sum, item) => sum + (Number(item.price) || 0),
              0
            );

            return (
              <div className={`recent-trip${trip.dbTripId === newlySavedTripId ? ' recent-trip-new' : ''}`} key={trip.dbTripId ?? trip.id ?? index}>
                <span>{formatDate(trip.date)}</span>
                <span>{trip.store}</span>
                <span className="recent-trip-total">{`£${total.toFixed(2)}`}</span>
                <span className="recent-trip-payer" style={{ "--payer-color": payer?.theme.primary }}>
                  {trip.defaultPayer}
                </span>
                <button className="recent-trip-action" type="button" title="Edit trip" aria-label="Edit trip" onClick={() => onEditTrip(trip)}>
                  <FaPen aria-hidden="true" />
                </button>
                <button className="recent-trip-action recent-trip-action-delete" type="button" title="Delete trip" aria-label="Delete trip" onClick={() => onDeleteTrip(trip)}>
                  <FaTrash aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
};