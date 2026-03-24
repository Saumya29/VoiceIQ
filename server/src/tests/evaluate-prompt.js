/**
 * Builds the prompt for evaluating a completed conversation against success criteria.
 */
export function buildEvaluatePrompt(conversation, successCriteria, scenario) {
  const convoText = conversation
    .map(t => `${t.role.toUpperCase()}: ${t.content}`)
    .join('\n\n');

  const criteriaText = successCriteria
    .map((c, i) => `${i + 1}. [${c.id}] (weight: ${c.weight}) ${c.description}`)
    .join('\n');

  return `You are an expert QA evaluator for voice AI agents. Evaluate the following conversation against the success criteria.

SCENARIO: ${scenario}

CONVERSATION:
"""
${convoText}
"""

SUCCESS CRITERIA:
${criteriaText}

For each criterion, evaluate whether the agent met it based on the conversation. Be strict but fair.

Return a JSON object:
{
  "criteriaResults": [
    {
      "id": "crit_1",
      "description": "The criterion description",
      "passed": true/false,
      "score": 0-100,
      "reasoning": "Brief explanation of why it passed or failed",
      "evidence": "Quote from the conversation supporting your judgment",
      "suggestion": "If failed: a specific, actionable fix for the agent's system prompt. If passed: leave empty string."
    }
  ],
  "overallScore": 0-100,
  "verdict": "pass|partial|fail",
  "summary": "One-sentence summary of the agent's performance"
}

SCORING RULES:
- Overall score is the weighted average of individual criterion scores
- verdict = "pass" if overallScore >= 80
- verdict = "partial" if overallScore >= 50
- verdict = "fail" if overallScore < 50
- Be specific in reasoning — cite what the agent did or failed to do
- For failed criteria, the suggestion must be a concrete prompt change (e.g., "Add an explicit step to ask for the caller's email address after confirming the appointment time")`;
}
