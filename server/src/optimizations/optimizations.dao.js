import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';

const parseJson = (row) => {
  if (!row) return null;
  return {
    ...row,
    prompt_diff: row.prompt_diff ? JSON.parse(row.prompt_diff) : null,
    failure_patterns: row.failure_patterns ? JSON.parse(row.failure_patterns) : [],
    changes_summary: row.changes_summary ? JSON.parse(row.changes_summary) : [],
    expected_improvements: row.expected_improvements ? JSON.parse(row.expected_improvements) : '',
  };
};

const parseJsonList = (rows) => rows.map(parseJson);

const OptimizationDao = {
  create({ agentId, testRunId, locationId, originalPrompt }) {
    const id = uuidv4();

    db.prepare(`
      INSERT INTO optimizations (id, agent_id, test_run_id, location_id, original_prompt)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, agentId, testRunId, locationId, originalPrompt);

    return this.getById(id);
  },

  complete(id, { optimizedPrompt, promptDiff, failurePatterns, changesSummary, expectedImprovements }) {
    db.prepare(`
      UPDATE optimizations
      SET optimized_prompt = ?, prompt_diff = ?, failure_patterns = ?,
          changes_summary = ?, expected_improvements = ?,
          status = 'generated', updated_at = datetime('now')
      WHERE id = ?
    `).run(
      optimizedPrompt, JSON.stringify(promptDiff),
      JSON.stringify(failurePatterns), JSON.stringify(changesSummary),
      JSON.stringify(expectedImprovements), id
    );

    return this.getById(id);
  },

  getById(id) {
    const row = db.prepare('SELECT * FROM optimizations WHERE id = ?').get(id);
    return parseJson(row);
  },

  listByAgentId(agentId) {
    const rows = db.prepare(
      'SELECT * FROM optimizations WHERE agent_id = ? ORDER BY created_at DESC'
    ).all(agentId);
    return parseJsonList(rows);
  },

  updateStatus(id, status) {
    db.prepare(
      "UPDATE optimizations SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(status, id);
    return this.getById(id);
  },
};

export default OptimizationDao;
