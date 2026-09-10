import { useState } from 'react';

export default function InventoryForm({ initial, onSubmit }) {
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer || '');
  const [model, setModel] = useState(initial?.model || '');
  const [quantity, setQuantity] = useState(initial?.quantity?.toString() ?? '1');
  const [location, setLocation] = useState(initial?.location || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!manufacturer.trim()) {
      setError('Manufacturer is required');
      return;
    }
    if (!model.trim()) {
      setError('Model is required');
      return;
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 0) {
      setError('Quantity must be a whole number of 0 or more');
      return;
    }
    setError('');
    try {
      await onSubmit({
        manufacturer: manufacturer.trim(),
        model: model.trim(),
        quantity: qty,
        location: location.trim(),
        notes: notes.trim(),
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form id="inventory-form" onSubmit={handleSubmit}>
      {error && <div className="error-banner">{error}</div>}
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="stock-manufacturer" className="required">
            Manufacturer
          </label>
          <input
            id="stock-manufacturer"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            placeholder="e.g. Crestron"
            autoFocus
          />
        </div>
        <div className="form-field">
          <label htmlFor="stock-model" className="required">
            Model
          </label>
          <input
            id="stock-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g. HD-TX-4KZ-101"
          />
        </div>
        <div className="form-field">
          <label htmlFor="stock-quantity" className="required">
            Quantity
          </label>
          <input
            id="stock-quantity"
            type="number"
            min="0"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="stock-location">Location</label>
          <input
            id="stock-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Minneapolis warehouse"
          />
        </div>
        <div className="form-field full-width">
          <label htmlFor="stock-notes">Notes</label>
          <textarea
            id="stock-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ready for deployment, spare for room issues, etc."
          />
        </div>
      </div>
    </form>
  );
}
