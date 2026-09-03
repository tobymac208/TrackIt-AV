const { decrypt } = require('./crypto');

function mapHardwareRow(row, includePassword = false) {
  if (!row) return null;
  const { password_encrypted, ...rest } = row;
  return {
    ...rest,
    password: includePassword && password_encrypted ? decrypt(password_encrypted) : null,
    has_password: Boolean(password_encrypted),
  };
}

module.exports = { mapHardwareRow };
