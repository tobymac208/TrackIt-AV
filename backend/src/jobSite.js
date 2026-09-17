const JOB_SITE_PREFIX = 'Conf-JOB';
const JOB_SITE_OFFICE_NAME = 'Job Sites';

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT',
  'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
]);

const JOB_SITE_PREFIX_PATTERN = /^conf-job[- ]/i;
const JOB_SITE_PARSE_PATTERN = /^conf-job[- ]([A-Za-z0-9]+)(?:[- ](.+))?$/i;

function normalizeStateCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return US_STATE_CODES.has(code) ? code : '';
}

function normalizeSiteCode(value) {
  const code = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return code;
}

function normalizeJobSiteRoomName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '-');
}

function buildJobSiteName(state, roomName) {
  const stateCode = normalizeStateCode(state) || normalizeSiteCode(state);
  const siteName = normalizeJobSiteRoomName(roomName);
  if (!stateCode || !siteName) return '';
  return `${JOB_SITE_PREFIX}-${stateCode}-${siteName}`;
}

function parseJobSiteName(name) {
  const match = String(name || '').trim().match(JOB_SITE_PARSE_PATTERN);
  if (!match) return null;
  const state = normalizeSiteCode(match[1]);
  const roomName = (match[2] || '').trim();
  if (!state || !roomName) return null;
  return { state, roomName };
}

function isJobSiteName(name) {
  return JOB_SITE_PREFIX_PATTERN.test(String(name || '').trim());
}

function jobSiteNameFromImportRow(row) {
  const candidates = [row?.belongsTo, row?.belongsToParsed?.fullIdentifier, row?.room];
  for (const value of candidates) {
    const name = String(value || '').trim();
    if (isJobSiteName(name)) return name;
  }
  return '';
}

async function ensureJobSitesOffice(db) {
  const existing = await db.prepare('SELECT id FROM offices WHERE name = ?').get(JOB_SITE_OFFICE_NAME);
  if (existing) return existing.id;
  const created = await db.prepare('INSERT INTO offices (name) VALUES (?)').run(JOB_SITE_OFFICE_NAME);
  return created.lastInsertRowid;
}

async function ensureJobSiteRoom(db, name, offices, roomIndex, roomNamesMatch) {
  const roomName = String(name || '').trim();
  if (!isJobSiteName(roomName)) return null;

  const existing = roomIndex.find((entry) => roomNamesMatch(entry.room_name, roomName));
  if (existing) return existing;

  const officeId = await ensureJobSitesOffice(db);
  if (!offices.some((office) => Number(office.id) === Number(officeId))) {
    offices.push({ id: officeId, name: JOB_SITE_OFFICE_NAME });
  }

  try {
    const result = await db
      .prepare('INSERT INTO conference_rooms (office_id, name, status, issue_description) VALUES (?, ?, ?, ?)')
      .run(officeId, roomName, 'functional', null);
    const created = {
      id: result.lastInsertRowid,
      room_name: roomName,
      office_id: officeId,
      office_name: JOB_SITE_OFFICE_NAME,
    };
    roomIndex.push(created);
    return created;
  } catch (err) {
    if (db.isUniqueViolation(err)) {
      const row = await db
        .prepare(
          `
        SELECT cr.id, cr.name AS room_name, o.id AS office_id, o.name AS office_name
        FROM conference_rooms cr
        JOIN offices o ON o.id = cr.office_id
        WHERE cr.office_id = ? AND cr.name = ?
      `
        )
        .get(officeId, roomName);
      if (row) {
        if (!roomIndex.some((entry) => Number(entry.id) === Number(row.id))) {
          roomIndex.push(row);
        }
        return row;
      }
    }
    throw err;
  }
}

module.exports = {
  JOB_SITE_PREFIX,
  JOB_SITE_OFFICE_NAME,
  normalizeStateCode,
  normalizeSiteCode,
  normalizeJobSiteRoomName,
  buildJobSiteName,
  parseJobSiteName,
  isJobSiteName,
  jobSiteNameFromImportRow,
  ensureJobSitesOffice,
  ensureJobSiteRoom,
};
