import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';

const parseJson = (row) => {
  if (!row) return null;
  return {
    ...row,
    persona: row.persona ? JSON.parse(row.persona) : null,
    success_criteria: row.success_criteria ? JSON.parse(row.success_criteria) : null,
  };
};

const parseJsonList = (rows) => rows.map(parseJson);

const TestCaseDao = {
  createMany(testRunId, testCases) {
    const insert = db.prepare(`
      INSERT INTO test_cases (id, test_run_id, category, persona, scenario, success_criteria, opening_message, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAll = db.transaction((cases) => {
      return cases.map((tc, index) => {
        const id = uuidv4();
        insert.run(
          id, testRunId, tc.category,
          JSON.stringify(tc.persona), tc.scenario,
          JSON.stringify(tc.successCriteria), tc.openingMessage,
          index
        );
        return id;
      });
    });

    const ids = insertAll(testCases);
    return this.listByTestRunId(testRunId);
  },

  getById(id) {
    const row = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(id);
    return parseJson(row);
  },

  listByTestRunId(testRunId) {
    const rows = db.prepare(
      'SELECT * FROM test_cases WHERE test_run_id = ? ORDER BY sort_order'
    ).all(testRunId);
    return parseJsonList(rows);
  },

  update(id, { persona, scenario, successCriteria, openingMessage }) {
    db.prepare(`
      UPDATE test_cases
      SET persona = ?, scenario = ?, success_criteria = ?, opening_message = ?
      WHERE id = ?
    `).run(
      JSON.stringify(persona), scenario,
      JSON.stringify(successCriteria), openingMessage, id
    );
    return this.getById(id);
  },

  deleteByTestRunId(testRunId) {
    db.prepare('DELETE FROM test_cases WHERE test_run_id = ?').run(testRunId);
  },
};

export default TestCaseDao;
