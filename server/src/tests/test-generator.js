import OpenAIClient from '../services/openai-client.js';
import { buildGenerateTestsPrompt } from './generate-tests-prompt.js';
import TestRunDao from './test-run.dao.js';
import TestCaseDao from './test-case.dao.js';

const TestGenerator = {
  /**
   * Generate test cases for an agent.
   * @param {object} agent - Normalized agent object
   * @param {object} analysis - Analysis result from the analyze endpoint
   * @param {object} config - { categories: string[], casesPerCategory: number }
   * @returns {object} - { testRun, testCases }
   */
  async generate(agent, analysis, config) {
    const { categories, casesPerCategory } = config;

    // Create the test run record
    const testRun = TestRunDao.create({
      agentId: agent.id,
      agentName: agent.name,
      locationId: agent.locationId,
      config,
    });

    // Generate test cases for each category in parallel
    const promises = categories.map(async (category) => {
      const prompt = buildGenerateTestsPrompt(agent, analysis, category, casesPerCategory);
      const result = await OpenAIClient.completeJson(prompt);
      return (result.testCases || []).map(tc => ({ ...tc, category }));
    });

    const results = await Promise.all(promises);
    const allCases = results.flat();

    // Store all test cases in DB
    const testCases = TestCaseDao.createMany(testRun.id, allCases);

    // Update total_cases to actual count
    const updated = TestRunDao.getById(testRun.id);

    return { testRun: updated, testCases };
  },
};

export default TestGenerator;
