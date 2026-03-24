import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from './env.js';

const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.databasePath);

// Enable WAL mode for concurrent reads/writes (important during SSE streaming)
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS installations (
    location_id TEXT PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TEXT,
    company_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS test_runs (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    agent_name TEXT,
    location_id TEXT,
    parent_run_id TEXT,
    config TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    total_cases INTEGER DEFAULT 0,
    completed_cases INTEGER DEFAULT 0,
    passed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    partial INTEGER DEFAULT 0,
    overall_score REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS test_cases (
    id TEXT PRIMARY KEY,
    test_run_id TEXT NOT NULL,
    category TEXT NOT NULL,
    persona TEXT NOT NULL,
    scenario TEXT NOT NULL,
    success_criteria TEXT NOT NULL,
    opening_message TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS test_results (
    id TEXT PRIMARY KEY,
    test_run_id TEXT NOT NULL,
    test_case_id TEXT NOT NULL,
    conversation TEXT,
    criteria_results TEXT,
    overall_score REAL,
    verdict TEXT,
    turn_count INTEGER DEFAULT 0,
    error TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS optimizations (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    test_run_id TEXT NOT NULL,
    location_id TEXT,
    original_prompt TEXT NOT NULL,
    optimized_prompt TEXT,
    prompt_diff TEXT,
    failure_patterns TEXT,
    changes_summary TEXT,
    expected_improvements TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_test_runs_agent_id ON test_runs(agent_id);
  CREATE INDEX IF NOT EXISTS idx_test_runs_location_id ON test_runs(location_id);
  CREATE INDEX IF NOT EXISTS idx_test_runs_parent_run_id ON test_runs(parent_run_id);
  CREATE INDEX IF NOT EXISTS idx_test_cases_test_run_id ON test_cases(test_run_id);
  CREATE INDEX IF NOT EXISTS idx_test_results_test_run_id ON test_results(test_run_id);
  CREATE INDEX IF NOT EXISTS idx_test_results_test_case_id ON test_results(test_case_id);
  CREATE INDEX IF NOT EXISTS idx_optimizations_agent_id ON optimizations(agent_id);
  CREATE INDEX IF NOT EXISTS idx_optimizations_test_run_id ON optimizations(test_run_id);
`);

export default db;
