import { useRef, useState } from 'react';
import { api } from '../api/client';

const TEMPLATE_CSV = `manufacturer,model,description,estimated_replacement_cost,mac_address,ip_address,serial_number,software_version,username,password,importance_level,end_of_support_date,upgrade_recommendations,office,room
Crestron,DM-NVX-363,Primary video encoder,2500.00,00:1A:2B:3C:4D:5E,192.168.1.100,SN-12345,1.5023.00041,admin,secret123,high,2027-06-30,Upgrade to NVX-384 when budget allows,Minneapolis HQ,Boardroom A
`;

export default function HardwareImport({ onClose, onComplete }) {
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hardware-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
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
      const data = await api.importHardware(csv);
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
        <strong>model</strong>, or a single <strong>product</strong> column (e.g. &quot;Cisco Touch 10&quot; is
        split automatically). Webex <strong>belongsto</strong> values like{' '}
        <code>602-322-6177 PHX.Integrity@ryancompanies.com</code> are parsed as site code <strong>PHX</strong> + room{' '}
        <strong>Integrity</strong> and matched to your offices and rooms automatically.
      </p>

      <div className="actions" style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
          Download Template
        </button>
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
