export const JOB_SITE_PREFIX = 'Conf-JOB';
export const JOB_SITE_OFFICE_NAME = 'Job Sites';

export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

const STATE_CODES = new Set(US_STATES.map((state) => state.code));
const JOB_SITE_PREFIX_PATTERN = /^conf-job[- ]/i;
const JOB_SITE_PARSE_PATTERN = /^conf-job[- ]([A-Za-z0-9]+)(?:[- ](.+))?$/i;

export function normalizeStateCode(value) {
  const code = String(value || '')
    .trim()
    .toUpperCase();
  return STATE_CODES.has(code) ? code : '';
}

export function normalizeSiteCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function normalizeJobSiteRoomName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '-');
}

export function buildJobSiteName(state, roomName) {
  const stateCode = normalizeStateCode(state) || normalizeSiteCode(state);
  const siteName = normalizeJobSiteRoomName(roomName);
  if (!stateCode || !siteName) return '';
  return `${JOB_SITE_PREFIX}-${stateCode}-${siteName}`;
}

export function parseJobSiteName(name) {
  const match = String(name || '').trim().match(JOB_SITE_PARSE_PATTERN);
  if (!match) return null;
  const state = normalizeSiteCode(match[1]);
  const roomName = (match[2] || '').trim();
  if (!state || !roomName) return null;
  return { state, roomName };
}

export function isJobSiteName(name) {
  return JOB_SITE_PREFIX_PATTERN.test(String(name || '').trim());
}

export function jobSiteCodeName(state) {
  const code = normalizeSiteCode(state);
  return code ? `${JOB_SITE_PREFIX}-${code}` : '—';
}
