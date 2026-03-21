import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';

const parseJson = (row) => {
  if (!row) return null;
  return {
    ...row,
    config: row.config ? JSON.parse(row.config) : null,
  };
};

const parseJsonList = (rows) => rows.map(parseJson);

const TestRunDao = {
  create({ agentId, agentName, locationId, config, parentRunId = null }) {
    const id = uuidv4();
    const totalCases = (config.categories?.length || 0) * (config.casesPerCategory || 0);

    db.prepare(`
      INSERT INTO test_runs (id, agent_id, agent_name, location_id, parent_run_id, config, total_cases)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, agentId, agentName, locationId, parentRunId, JSON.stringify(config), totalCases);

    return this.getById(id);
  },

  getById(id) {
    const row = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(id);
    return parseJson(row);
  },

  listByAgentId(agentId) {
    const rows = db.prepare(
      'SELECT * FROM test_runs WHERE agent_id = ? ORDER BY created_at DESC'
    ).all(agentId);
    return parseJsonList(rows);
  },

  updateStatus(id, status) {
    db.prepare(
      "UPDATE test_runs SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(status, id);
    return this.getById(id);
  },

  incrementResults(id, verdict) {
    const column = verdict === 'pass' ? 'passed' : verdict === 'partial' ? 'partial' : 'failed';
    db.prepare(`
      UPDATE test_runs
      SET ${column} = ${column} + 1,
          completed_cases = completed_cases + 1,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(id);
  },

  updateScore(id, overallScore) {
    db.prepare(
      "UPDATE test_runs SET overall_score = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(overallScore, id);
  },

  deleteById(id) {
    db.prepare('DELETE FROM test_runs WHERE id = ?').run(id);
  },
};

export default TestRunDao;
