import OpenAIClient from '../services/openai-client.js';
import { buildGenerateTestsPrompt } from './generate-tests-prompt.js';
import TestRunDao from './test-run.dao.js';
import TestCaseDao from './test-case.dao.js';

const TestGenerator = {
  async generate(agent, analysis, config) {
    const { categories, casesPerCategory } = config;

    const testRun = TestRunDao.create({
      agentId: agent.id,
      agentName: agent.name,
      locationId: agent.locationId,
      config,
    });

    const promises = categories.map(async (category) => {
      const prompt = buildGenerateTestsPrompt(agent, analysis, category, casesPerCategory);
      const result = await OpenAIClient.completeJson(prompt);
      return (result.testCases || []).map(tc => ({ ...tc, category }));
    });

    const results = await Promise.all(promises);
    const allCases = results.flat();

    const testCases = TestCaseDao.createMany(testRun.id, allCases);

    // Update total_cases to actual count (OpenAI may return more/fewer than requested)
    TestRunDao.updateTotalCases(testRun.id, allCases.length);
    const updated = TestRunDao.getById(testRun.id);

    return { testRun: updated, testCases };
  },
};

export default TestGenerator;
