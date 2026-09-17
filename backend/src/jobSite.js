const JOB_SITE_PREFIX = 'Conf-JOB';
const JOB_SITE_OFFICE_NAME = 'Job Sites';

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT',
  'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
]);

const JOB_SITE_PATTERN = /^Conf-JOB-([A-Za-z]{2})-(.+)$/;

function normalizeStateCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return US_STATE_CODES.has(code) ? code : '';
}

function normalizeJobSiteRoomName(value) {
  return String(value || '').trim().replace(/\s+/g, '-');
}

function buildJobSiteName(state, roomName) {
  const stateCode = normalizeStateCode(state);
  const siteName = normalizeJobSiteRoomName(roomName);
  if (!stateCode || !siteName) return '';
  return `${JOB_SITE_PREFIX}-${stateCode}-${siteName}`;
}

function parseJobSiteName(name) {
  const match = String(name || '').trim().match(JOB_SITE_PATTERN);
  if (!match) return null;
  const state = normalizeStateCode(match[1]);
  const siteName = normalizeJobSiteRoomName(match[2]);
  if (!state || !siteName) return null;
  return { state, roomName: siteName };
}

function isJobSiteName(name) {
  return Boolean(parseJobSiteName(name));
}

module.exports = {
  JOB_SITE_PREFIX,
  JOB_SITE_OFFICE_NAME,
  normalizeStateCode,
  normalizeJobSiteRoomName,
  buildJobSiteName,
  parseJobSiteName,
  isJobSiteName,
};
