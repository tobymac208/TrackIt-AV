const OFFICE_CODE_ALIASES = {
  PHX: ['Phoenix', 'PHX'],
  ATL: ['Atlanta', 'ATL'],
  AUS: ['Austin', 'AUS'],
  CR: ['Cedar Rapids', 'Cedar Rapids', 'CR'],
  MIN: ['Minneapolis', 'Minneapolis HQ', 'MIN', 'MSP'],
  MSP: ['Minneapolis', 'Minneapolis HQ', 'MSP', 'MIN'],
  SND: ['San Diego', 'SND'],
  SAN: ['San Diego', 'SAN', 'SND'],
  TMP: ['Tampa', 'TMP'],
  TPA: ['Tampa', 'TPA', 'TMP'],
  DSM: ['Des Moines', 'DSM'],
  DEN: ['Denver', 'DEN'],
  DFW: ['Dallas', 'DFW'],
  ORD: ['Chicago', 'ORD'],
  LAX: ['Los Angeles', 'LAX'],
  NYC: ['New York', 'NYC', 'New York City'],
  SEA: ['Seattle', 'SEA'],
};

function normalize(value) {
  return (value || '').trim().toLowerCase();
}

function normalizeRoomKey(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function roomNamesMatch(a, b) {
  return normalizeRoomKey(a) === normalizeRoomKey(b);
}

async function loadRoomIndex(db) {
  return db.prepare(`
    SELECT cr.id, cr.name AS room_name, o.id AS office_id, o.name AS office_name
    FROM conference_rooms cr
    JOIN offices o ON o.id = cr.office_id
  `).all();
}

async function loadOffices(db) {
  return db.prepare('SELECT id, name FROM offices').all();
}

function officeMatchesSiteCode(officeName, siteCode) {
  const code = siteCode.toUpperCase();
  const name = officeName.toUpperCase();

  if (name === code) return true;

  const aliases = OFFICE_CODE_ALIASES[code] || [];
  if (aliases.some((alias) => alias.toUpperCase() === name)) return true;

  if (name.startsWith(code) || name.includes(` ${code}`)) return true;

  const aliasPrefix = aliases.find((alias) => name.startsWith(alias.toUpperCase()));
  if (aliasPrefix) return true;

  return false;
}

function findOfficeBySiteCode(siteCode, offices) {
  if (!siteCode) return null;
  return offices.find((office) => officeMatchesSiteCode(office.name, siteCode)) || null;
}

function findRoomsByName(roomIndex, roomName, officeId = null) {
  let matches = roomIndex.filter((entry) => roomNamesMatch(entry.room_name, roomName));
  if (officeId) {
    matches = matches.filter((entry) => entry.office_id === officeId);
  }
  return matches;
}

function resolveWebexLocation(belongsToParsed, offices, roomIndex) {
  if (!belongsToParsed) {
    return { conferenceRoomId: null, warnings: [] };
  }

  const { siteCode, roomName, fullIdentifier } = belongsToParsed;
  const warnings = [];

  if (siteCode && roomName) {
    const office = findOfficeBySiteCode(siteCode, offices);
    if (office) {
      const matches = findRoomsByName(roomIndex, roomName, office.id);
      if (matches.length === 1) {
        return { conferenceRoomId: matches[0].id, warnings: [] };
      }
      if (matches.length > 1) {
        return {
          conferenceRoomId: null,
          warnings: [
            `Multiple rooms match "${roomName}" in office "${office.name}" (from ${fullIdentifier}) — imported as unassigned`,
          ],
        };
      }
      warnings.push(
        `Room "${roomName}" not found in office "${office.name}" (from ${fullIdentifier}) — trying other matches`
      );
    } else {
      warnings.push(`Office not found for site code "${siteCode}" (from ${fullIdentifier}) — trying room name only`);
    }
  }

  if (roomName) {
    const matches = findRoomsByName(roomIndex, roomName);
    if (matches.length === 1) {
      return {
        conferenceRoomId: matches[0].id,
        warnings: warnings.length ? warnings : [],
      };
    }
    if (matches.length > 1) {
      const officeNames = [...new Set(matches.map((m) => m.office_name))].join(', ');
      return {
        conferenceRoomId: null,
        warnings: [
          ...warnings,
          `Multiple rooms match "${roomName}" (${officeNames}) — imported as unassigned`,
        ],
      };
    }
  }

  if (fullIdentifier) {
    const fullMatches = findRoomsByName(roomIndex, fullIdentifier);
    if (fullMatches.length === 1) {
      return { conferenceRoomId: fullMatches[0].id, warnings };
    }
  }

  return {
    conferenceRoomId: null,
    warnings: [
      ...warnings,
      `Could not match location "${fullIdentifier || roomName || 'unknown'}" — imported as unassigned`,
    ],
  };
}

function resolveConferenceRoomLocation({ office, room, belongsToParsed }, offices, roomIndex) {
  const hasOffice = office && office.trim();
  const hasRoom = room && room.trim();

  if (belongsToParsed && !hasOffice) {
    const webexResult = resolveWebexLocation(belongsToParsed, offices, roomIndex);
    if (webexResult.conferenceRoomId) return webexResult;
    if (!hasRoom || roomNamesMatch(belongsToParsed.roomName, room)) {
      return webexResult;
    }
  }

  if (!hasOffice && !hasRoom) return { conferenceRoomId: null, warnings: [] };

  if (hasOffice && hasRoom) {
    const officeMatch = offices.find((entry) => normalize(entry.name) === normalize(office));
    if (!officeMatch) {
      return {
        conferenceRoomId: null,
        warnings: [`Conference room not found: ${office.trim()} / ${room.trim()} — imported as unassigned`],
      };
    }

    const matches = findRoomsByName(roomIndex, room, officeMatch.id);
    if (matches.length === 1) {
      return { conferenceRoomId: matches[0].id, warnings: [] };
    }
    return {
      conferenceRoomId: null,
      warnings: [`Conference room not found: ${office.trim()} / ${room.trim()} — imported as unassigned`],
    };
  }

  if (hasRoom && !hasOffice) {
    const matches = findRoomsByName(roomIndex, room);
    if (matches.length === 0) {
      return {
        conferenceRoomId: null,
        warnings: [`Conference room not found: ${room.trim()} — imported as unassigned`],
      };
    }
    if (matches.length > 1) {
      const officeNames = [...new Set(matches.map((m) => m.office_name))].join(', ');
      return {
        conferenceRoomId: null,
        warnings: [
          `Multiple rooms match "${room.trim()}" (${officeNames}) — imported as unassigned. Add an office column to disambiguate.`,
        ],
      };
    }
    return { conferenceRoomId: matches[0].id, warnings: [] };
  }

  return {
    conferenceRoomId: null,
    warnings: ['Room name is required when office is specified — imported as unassigned'],
  };
}

module.exports = {
  OFFICE_CODE_ALIASES,
  normalizeRoomKey,
  roomNamesMatch,
  loadRoomIndex,
  loadOffices,
  resolveWebexLocation,
  resolveConferenceRoomLocation,
};
