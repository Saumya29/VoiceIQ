import db from '../config/database.js';

const InstallationsDao = {
  upsert({ locationId, accessToken, refreshToken, expiresAt, companyName }) {
    db.prepare(`
      INSERT INTO installations (location_id, access_token, refresh_token, expires_at, company_name)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(location_id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        company_name = COALESCE(excluded.company_name, company_name),
        updated_at = datetime('now')
    `).run(locationId, accessToken, refreshToken, expiresAt, companyName);

    return this.getByLocationId(locationId);
  },

  getByLocationId(locationId) {
    return db.prepare('SELECT * FROM installations WHERE location_id = ?').get(locationId);
  },

  updateTokens(locationId, { accessToken, refreshToken, expiresAt }) {
    db.prepare(`
      UPDATE installations
      SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = datetime('now')
      WHERE location_id = ?
    `).run(accessToken, refreshToken, expiresAt, locationId);
  },

  deleteByLocationId(locationId) {
    db.prepare('DELETE FROM installations WHERE location_id = ?').run(locationId);
  },
};

export default InstallationsDao;
