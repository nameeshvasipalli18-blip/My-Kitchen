import { useState } from 'react';
import { FaMagnifyingGlass, FaPen, FaReceipt, FaTrash } from 'react-icons/fa6';
import './RecentTrips.css';

export const RecentTrips = ({ participants, shoppingTrips, newlySavedTripId, onEditTrip, onDeleteTrip, isMenuOpen, showMenuToggle = true }) => {
  const trips = Array.isArray(shoppingTrips) ? shoppingTrips : [];
  const [isOpen, setIsOpen] = useState(false);
  const billsVisible = isMenuOpen ?? isOpen;
  const [visibleTripCount, setVisibleTripCount] = useState(5);
  const [searchDate, setSearchDate] = useState('');
  const [submittedSearchDate, setSubmittedSearchDate] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [storeFilter, setStoreFilter] = useState('');
  const [payerFilter, setPayerFilter] = useState('');
  const stores = [...new Set(trips.map((trip) => trip.store).filter(Boolean))].sort();
  const payers = [...new Set(trips.map((trip) => trip.defaultPayer).filter(Boolean))].sort();
  const filteredTrips = trips.filter(
    (trip) =>
      (!submittedSearchDate || trip.date === submittedSearchDate) &&
      (!storeFilter || trip.store === storeFilter) &&
      (!payerFilter || trip.defaultPayer === payerFilter)
  );
  const sortedTrips = [...filteredTrips].sort((firstTrip, secondTrip) => {
    const comparison = String(firstTrip.date || '').localeCompare(String(secondTrip.date || ''));
    return sortOrder === 'newest' ? -comparison : comparison;
  });
  const visibleTrips = sortedTrips.slice(0, visibleTripCount);
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
    <aside className="recent-trips-menu" aria-label="Recent bills">
      {showMenuToggle && <button
        className="recent-trips-toggle"
        type="button"
        title={isOpen ? 'Hide recent bills' : 'Show recent bills'}
        aria-label={isOpen ? 'Hide recent bills' : 'Show recent bills'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <FaReceipt aria-hidden="true" />
        <span className="recent-trips-count">{trips.length}</span>
      </button>}
      {billsVisible && (
      <div className="recent-trips-container">
        <h2>Saved bills</h2>
      <div className="recent-trips-controls">
        <form
          className="recent-trips-search"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmittedSearchDate(searchDate);
            setVisibleTripCount(5);
          }}
        >
          <label className="sr-only" htmlFor="recent-trips-date-search">Search bills by date</label>
          <input
            id="recent-trips-date-search"
            type="date"
            value={searchDate}
            onChange={(event) => setSearchDate(event.target.value)}
          />
          <button type="submit" title="Search bills by date" aria-label="Search bills by date">
            <FaMagnifyingGlass aria-hidden="true" />
          </button>
        </form>
        <label className="recent-trips-select">
          <span>Sort bills</span>
          <select
            value={sortOrder}
            onChange={(event) => {
              setSortOrder(event.target.value);
              setVisibleTripCount(5);
            }}
          >
            <option value="newest">New first</option>
            <option value="oldest">Old first</option>
          </select>
        </label>
        <label className="recent-trips-select">
          <span>Filter by store</span>
          <select
            value={storeFilter}
            onChange={(event) => {
              setStoreFilter(event.target.value);
              setVisibleTripCount(5);
            }}
          >
            <option value="">All stores</option>
            {stores.map((store) => (
              <option key={store} value={store}>{store}</option>
            ))}
          </select>
        </label>
        <label className="recent-trips-select">
          <span>Filter by payer</span>
          <select
            value={payerFilter}
            onChange={(event) => {
              setPayerFilter(event.target.value);
              setVisibleTripCount(5);
            }}
          >
            <option value="">All payers</option>
            {payers.map((payer) => (
              <option key={payer} value={payer}>{payer}</option>
            ))}
          </select>
        </label>
      </div>
      {trips.length === 0 ? (
        <p className="recent-trips-empty">No saved bills yet.</p>
      ) : filteredTrips.length === 0 ? (
        <p className="recent-trips-empty">No bills match your search or filter.</p>
      ) : (
        <div className="recent-trips-list">
          <div className="recent-trips-header" aria-hidden="true">
            <span>Date</span>
            <span>Store</span>
            <span>Total</span>
            <span>Paid by</span>
          </div>
          {visibleTrips.map((trip, index) => {
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
                <button className="recent-trip-action" type="button" title="Edit bill" aria-label="Edit bill" onClick={() => onEditTrip(trip)}>
                  <FaPen aria-hidden="true" />
                </button>
                <button className="recent-trip-action recent-trip-action-delete" type="button" title="Delete bill" aria-label="Delete bill" onClick={() => onDeleteTrip(trip)}>
                  <FaTrash aria-hidden="true" />
                </button>
              </div>
            );
          })}
          {visibleTripCount < sortedTrips.length && (
            <button
              className="recent-trips-more"
              type="button"
              onClick={() => setVisibleTripCount((count) => count + 5)}
            >
              View later bills
            </button>
          )}
        </div>
      )}
      </div>
      )}
    </aside>
  );
};