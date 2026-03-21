import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';

const parseJson = (row) => {
  if (!row) return null;
  return {
    ...row,
    conversation: row.conversation ? JSON.parse(row.conversation) : [],
    criteria_results: row.criteria_results ? JSON.parse(row.criteria_results) : [],
  };
};

const parseJsonList = (rows) => rows.map(parseJson);

const TestResultDao = {
  create({ testRunId, testCaseId }) {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO test_results (id, test_run_id, test_case_id, started_at)
      VALUES (?, ?, ?, ?)
    `).run(id, testRunId, testCaseId, now);

    return id;
  },

  complete(id, { conversation, criteriaResults, overallScore, verdict, turnCount }) {
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE test_results
      SET conversation = ?, criteria_results = ?, overall_score = ?,
          verdict = ?, turn_count = ?, completed_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(conversation), JSON.stringify(criteriaResults),
      overallScore, verdict, turnCount, now, id
    );

    return this.getById(id);
  },

  setError(id, error) {
    const now = new Date().toISOString();
    db.prepare(
      'UPDATE test_results SET error = ?, verdict = ?, completed_at = ? WHERE id = ?'
    ).run(error, 'fail', now, id);
  },

  getById(id) {
    const row = db.prepare('SELECT * FROM test_results WHERE id = ?').get(id);
    return parseJson(row);
  },

  listByTestRunId(testRunId) {
    const rows = db.prepare(
      'SELECT * FROM test_results WHERE test_run_id = ? ORDER BY created_at'
    ).all(testRunId);
    return parseJsonList(rows);
  },

  getByTestCaseId(testCaseId) {
    const row = db.prepare(
      'SELECT * FROM test_results WHERE test_case_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(testCaseId);
    return parseJson(row);
  },

  getExecutedCaseIds(testRunId) {
    const rows = db.prepare(
      'SELECT test_case_id FROM test_results WHERE test_run_id = ? AND completed_at IS NOT NULL'
    ).all(testRunId);
    return rows.map(r => r.test_case_id);
  },
};

export default TestResultDao;
