export function buildOptimizePrompt(originalPrompt, failedResults, passedResults) {
  const failedSection = failedResults.map((r, i) => {
    const convo = r.conversation
      .map(t => `  ${t.role.toUpperCase()}: ${t.content}`)
      .join('\n');
    const criteria = r.criteria_results
      .filter(c => !c.passed)
      .map(c => `  - FAILED: ${c.description} — ${c.reasoning}`)
      .join('\n');
    return `--- Failed Test ${i + 1} (Score: ${r.overall_score}%) ---\nScenario: ${r.scenario}\n${criteria}\nConversation:\n${convo}`;
  }).join('\n\n');

  const passedSection = passedResults.slice(0, 3).map((r, i) => {
    const convo = r.conversation
      .map(t => `  ${t.role.toUpperCase()}: ${t.content}`)
      .join('\n');
    return `--- Passed Test ${i + 1} (Score: ${r.overall_score}%) ---\nScenario: ${r.scenario}\nConversation:\n${convo}`;
  }).join('\n\n');

  return `You are an expert prompt engineer specializing in voice AI agents. Your task is to improve the agent's system prompt based on test failures while preserving what already works.

ORIGINAL SYSTEM PROMPT:
"""
${originalPrompt}
"""

FAILED TESTS (the agent struggled with these):
${failedSection}

PASSED TESTS (the agent handled these well — preserve this behavior):
${passedSection}

INSTRUCTIONS:
1. Analyze the failure patterns — what went wrong and why
2. Generate an improved system prompt that addresses the failures
3. Do NOT remove or weaken instructions that led to passing tests
4. Be specific in your improvements — add explicit handling for the failure scenarios
5. Keep the same overall structure and tone as the original

Return a JSON object:
{
  "failurePatterns": [
    { "pattern": "Description of the failure pattern", "severity": "high|medium|low", "affectedTests": 1 }
  ],
  "changes": [
    { "description": "What was changed and why", "type": "added|modified|removed" }
  ],
  "optimizedPrompt": "The full improved system prompt text",
  "expectedImprovements": "Summary of what should improve with this new prompt"
}`;
}
