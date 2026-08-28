function normalizeHeader(header) {
  return header.trim().toLowerCase().replace(/[#]/g, '').replace(/\s+/g, '_');
}

const HEADER_ALIASES = {
  manufacturer: 'manufacturer',
  model: 'model',
  description: 'description',
  estimated_replacement_cost: 'estimatedReplacementCost',
  estimated_cost: 'estimatedReplacementCost',
  est_replacement_cost: 'estimatedReplacementCost',
  mac_address: 'macAddress',
  mac: 'macAddress',
  ip_address: 'ipAddress',
  ip: 'ipAddress',
  serial_number: 'serialNumber',
  serial: 'serialNumber',
  software_version: 'softwareVersion',
  software: 'softwareVersion',
  username: 'username',
  password: 'password',
  importance_level: 'importanceLevel',
  importance: 'importanceLevel',
  end_of_support_date: 'endOfSupportDate',
  eos_date: 'endOfSupportDate',
  end_of_support: 'endOfSupportDate',
  end_of_warranty_date: 'endOfWarrantyDate',
  warranty_date: 'endOfWarrantyDate',
  end_of_warranty: 'endOfWarrantyDate',
  warranty_expiration: 'endOfWarrantyDate',
  warranty_expiration_date: 'endOfWarrantyDate',
  lifecycle: 'lifecycle',
  upgrade_recommendations: 'upgradeRecommendations',
  upgrade_recommendation: 'upgradeRecommendations',
  office: 'office',
  office_name: 'office',
  room: 'room',
  room_name: 'room',
  conference_room: 'room',
  belongsto: 'belongsTo',
  belongs_to: 'belongsTo',
  product: 'product',
};

function splitProduct(product) {
  const trimmed = product.trim();
  if (!trimmed) return { manufacturer: '', model: '' };

  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) {
    return { manufacturer: trimmed, model: trimmed };
  }

  return {
    manufacturer: trimmed.slice(0, spaceIdx).trim(),
    model: trimmed.slice(spaceIdx + 1).trim(),
  };
}

function parseBelongsTo(value) {
  if (!value) return null;
  const trimmed = value.trim();

  const atIdx = trimmed.indexOf('@');
  const beforeAt = atIdx === -1 ? trimmed : trimmed.slice(0, atIdx).trim();
  const identifier = beforeAt.replace(/^[\d\-+().\s]+(?=\S)/, '').trim() || beforeAt;

  const dotIdx = identifier.indexOf('.');
  if (dotIdx === -1) {
    return {
      siteCode: null,
      roomName: identifier,
      fullIdentifier: identifier,
      raw: trimmed,
    };
  }

  return {
    siteCode: identifier.slice(0, dotIdx).trim(),
    roomName: identifier.slice(dotIdx + 1).trim(),
    fullIdentifier: identifier,
    raw: trimmed,
  };
}

function normalizeImportRow(row) {
  const normalized = { ...row };

  if (normalized.belongsTo) {
    const parsed = parseBelongsTo(normalized.belongsTo);
    normalized.belongsToParsed = parsed;
    normalized.room = parsed.roomName;
  }

  if (normalized.product) {
    const { manufacturer, model } = splitProduct(normalized.product);
    if (!normalized.manufacturer) normalized.manufacturer = manufacturer;
    if (!normalized.model) normalized.model = model;
  }

  if (normalized.lifecycle) {
    const lifecycle = normalized.lifecycle.trim().toUpperCase();
    if (lifecycle.includes('END_OF')) {
      normalized.endOfSupportDate = normalized.endOfSupportDate || new Date().toISOString().slice(0, 10);
    }
  }

  return normalized;
}

function mapHeader(header) {
  const normalized = normalizeHeader(header);
  return HEADER_ALIASES[normalized] || null;
}

function detectDelimiter(line) {
  const commaCount = (line.match(/,/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;
  const tabCount = (line.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
}

function preprocessCsvText(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  let delimiter = ',';

  const contentLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const sepMatch = trimmed.match(/^sep=(.+)$/i);
    if (sepMatch) {
      delimiter = sepMatch[1].trim() || ',';
      continue;
    }

    contentLines.push(line);
  }

  return { lines: contentLines, delimiter };
}

function parseCsvLine(line, delimiter = ',') {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map((v) => v.trim());
}

function parseCsv(text) {
  const { lines, delimiter } = preprocessCsvText(text);
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  const rawHeaders = parseCsvLine(lines[0], delimiter);
  const fieldMap = rawHeaders.map((h) => mapHeader(h));

  const hasManufacturerModel = fieldMap.includes('manufacturer') && fieldMap.includes('model');
  const hasProduct = fieldMap.includes('product');
  if (!hasManufacturerModel && !hasProduct) {
    const found = rawHeaders.filter(Boolean).slice(0, 6).join(', ') || '(none)';
    throw new Error(
      `CSV must include manufacturer and model columns, or a product column. Found headers: ${found}`
    );
  }

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line, delimiter);
    if (values.every((v) => !v)) continue;

    const row = { _line: i + 1 };
    fieldMap.forEach((field, index) => {
      if (field && values[index] !== undefined && values[index] !== '') {
        row[field] = values[index];
      }
    });
    rows.push(normalizeImportRow(row));
  }

  return rows;
}

module.exports = { parseCsv, splitProduct, parseBelongsTo, normalizeImportRow, HEADER_ALIASES };
