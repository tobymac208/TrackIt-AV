import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

const TEMPLATE_CSV = `manufacturer,model,description,estimated_replacement_cost,mac_address,ip_address,serial_number,software_version,username,password,importance_level,end_of_support_date,end_of_warranty_date,recommended_replacement_date,upgrade_recommendations,office,room
Crestron,DM-NVX-363,Primary video encoder,2500.00,00:1A:2B:3C:4D:5E,192.168.1.100,SN-12345,1.5023.00041,admin,secret123,high,2027-06-30,2026-12-31,2028-06-30,Upgrade to NVX-384 when budget allows,Minneapolis HQ,Boardroom A
`;

export default function HardwareImport({ onClose, onComplete }) {
  const fileRef = useRef(null);
  const [offices, setOffices] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [officeId, setOfficeId] = useState('');
  const [conferenceRoomId, setConferenceRoomId] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    Promise.all([api.getOffices(), api.getRooms()])
      .then(([officeRows, roomRows]) => {
        setOffices(officeRows);
        setRooms(roomRows);
      })
      .catch((err) => setError(err.message));
  }, []);

  const roomsInOffice = officeId
    ? rooms.filter((room) => String(room.office_id) === String(officeId))
    : rooms;

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hardware-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOfficeChange = (value) => {
    setOfficeId(value);
    if (!value) {
      setConferenceRoomId('');
      return;
    }
    const selectedRoom = rooms.find((room) => String(room.id) === String(conferenceRoomId));
    if (selectedRoom && String(selectedRoom.office_id) !== String(value)) {
      setConferenceRoomId('');
    }
  };

  const handleRoomChange = (value) => {
    setConferenceRoomId(value);
    if (!value) return;
    const selectedRoom = rooms.find((room) => String(room.id) === String(value));
    if (selectedRoom) {
      setOfficeId(String(selectedRoom.office_id));
    }
  };

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Please select a CSV file');
      return;
    }

    setImporting(true);
    setError('');
    setResult(null);

    try {
      const csv = await file.text();
      const data = await api.importHardware(csv, {
        officeId: officeId ? Number(officeId) : undefined,
        conferenceRoomId: conferenceRoomId ? Number(conferenceRoomId) : undefined,
      });
      setResult(data);
      if (data.imported > 0) {
        onComplete();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      {error && <div className="error-banner">{error}</div>}

      <p style={{ marginTop: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Upload a CSV file to bulk-import hardware. Required columns: <strong>manufacturer</strong> +{' '}
        <strong>model</strong>, a <strong>product</strong> column, or a Meraki-style{' '}
        <strong>manufacturer</strong> + <strong>name or description</strong> export. If the file has no
        location, pick an office and conference room below. CSV location columns still win when present.
      </p>

      <div className="actions" style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
          Download Template
        </button>
      </div>

      <div className="form-grid" style={{ marginBottom: '1rem' }}>
        <div className="form-field">
          <label htmlFor="import-office">Office (optional)</label>
          <select id="import-office" value={officeId} onChange={(e) => handleOfficeChange(e.target.value)}>
            <option value="">No default office</option>
            {offices.map((office) => (
              <option key={office.id} value={office.id}>
                {office.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="import-room">Conference room (optional)</label>
          <select
            id="import-room"
            value={conferenceRoomId}
            onChange={(e) => handleRoomChange(e.target.value)}
          >
            <option value="">Leave unassigned if CSV has no location</option>
            {roomsInOffice.map((room) => (
              <option key={room.id} value={room.id}>
                {officeId ? room.name : `${room.office_name} — ${room.name}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="csv-file">CSV File</label>
        <input id="csv-file" ref={fileRef} type="file" accept=".csv,text/csv" />
      </div>

      {result && (
        <div className={`import-result ${result.failed.length ? 'import-result-partial' : 'import-result-success'}`}>
          <p>
            <strong>{result.imported}</strong> device{result.imported !== 1 ? 's' : ''} imported
            {result.failed.length > 0 && (
              <>
                , <strong>{result.failed.length}</strong> failed
              </>
            )}
            {result.warnings?.length > 0 && (
              <>
                , <strong>{result.warnings.length}</strong> warning{result.warnings.length !== 1 ? 's' : ''}
              </>
            )}
          </p>
          {result.warnings?.length > 0 && (
            <ul className="import-warnings">
              {result.warnings.slice(0, 10).map((item) => (
                <li key={`${item.line}-${item.message}`}>
                  Row {item.line}: {item.message}
                </li>
              ))}
              {result.warnings.length > 10 && <li>...and {result.warnings.length - 10} more warnings</li>}
            </ul>
          )}
          {result.failed.length > 0 && (
            <ul className="import-errors">
              {result.failed.map((item) => (
                <li key={`${item.line}-${item.errors.join('-')}`}>
                  Row {item.line}: {item.errors.join('; ')}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="modal-footer" style={{ margin: '1.5rem -1.5rem -1.5rem', padding: '1rem 0 0' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={importing}>
          Close
        </button>
        <button type="button" className="btn btn-primary" onClick={handleImport} disabled={importing}>
          {importing ? 'Importing...' : 'Import CSV'}
        </button>
      </div>
    </>
  );
}
