import { useEffect } from 'react';
import { FaReceipt, FaTrash, FaTriangleExclamation, FaXmark } from 'react-icons/fa6';
import './ReceiptScanReview.css';

const formatAmount = (amount) => Number(amount || 0).toFixed(2);

export const ReceiptScanLoading = ({ isOpen }) => {
  if (!isOpen) return null;

  return (
    <div className="receipt-scan-overlay receipt-scan-loading-overlay" role="status" aria-live="assertive" aria-label="Scanning e-bill">
      <section className="receipt-scan-loading">
        <span className="receipt-scan-loading-icon" aria-hidden="true"><FaReceipt /></span>
        <div>
          <strong>Scanning e-bill</strong>
          <span>Extracting receipt items</span>
        </div>
        <span className="receipt-scan-loading-dots" aria-hidden="true"><i /><i /><i /></span>
      </section>
    </div>
  );
};

export const ReceiptScanReview = ({ isOpen, items, scanResult, onChangeItem, onDeleteItem, onConfirm, onCancel }) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const totalAvailable = scanResult?.total !== null && scanResult?.total !== undefined && Number.isFinite(Number(scanResult.total));
  const editedItemsTotal = items.reduce((total, item) => total + (Number(item.price) || 0), 0);
  const totalMatches = totalAvailable && Math.abs(editedItemsTotal - Number(scanResult.total)) <= 0.01;

  return (
    <div className="receipt-scan-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="receipt-scan-review" role="dialog" aria-modal="true" aria-labelledby="receipt-scan-title">
        <header className="receipt-scan-header">
          <div>
            <h2 id="receipt-scan-title">Review scanned items</h2>
            <p>Nothing is added until you confirm.</p>
          </div>
          <button type="button" className="receipt-scan-close" title="Cancel receipt scan" aria-label="Cancel receipt scan" onClick={onCancel}>
            <FaXmark aria-hidden="true" />
          </button>
        </header>

        {(!totalAvailable || !totalMatches) && (
          <p className="receipt-scan-warning" role="status">
            <FaTriangleExclamation aria-hidden="true" />
            {totalAvailable
              ? `Reviewed items total £${formatAmount(editedItemsTotal)} but the receipt total is £${formatAmount(scanResult?.total)}.`
              : 'A receipt total was not detected. Check the scanned items before adding them.'}
          </p>
        )}

        <div className="receipt-scan-items" aria-label="Scanned receipt items">
          {items.length === 0 ? <p className="receipt-scan-empty">No items remain to add.</p> : items.map((item, index) => (
            <div className="receipt-scan-item" key={`${item.name}-${index}`}>
              <input aria-label={`Scanned item ${index + 1} name`} value={item.name} onChange={(event) => onChangeItem(index, 'name', event.target.value)} />
              <input aria-label={`Scanned item ${index + 1} price`} type="number" min="0" step="0.01" inputMode="decimal" value={item.price} onChange={(event) => onChangeItem(index, 'price', event.target.value)} />
              <button type="button" title={`Remove ${item.name || 'item'}`} aria-label={`Remove ${item.name || 'item'}`} onClick={() => onDeleteItem(index)}>
                <FaTrash aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        <footer className="receipt-scan-footer">
          <div className="receipt-scan-totals">
            <span>Items: £{formatAmount(editedItemsTotal)}</span>
            {totalAvailable && <strong>Receipt: £{formatAmount(scanResult?.total)}</strong>}
          </div>
          <div className="receipt-scan-actions">
            <button type="button" onClick={onCancel}>Cancel</button>
            <button type="button" disabled={items.length === 0} onClick={onConfirm}>Add {items.length} item{items.length === 1 ? '' : 's'}</button>
          </div>
        </footer>
      </section>
    </div>
  );
};