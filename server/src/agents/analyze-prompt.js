/**
 * Builds the prompt that asks GPT to extract structured analysis from a voice agent's system prompt.
 */
export function buildAnalyzePrompt(agentName, systemPrompt) {
  return `You are an expert voice AI analyst. Analyze the following voice agent's system prompt and extract a structured breakdown.

Agent Name: ${agentName}

System Prompt:
"""
${systemPrompt}
"""

Analyze this prompt and return a JSON object with the following structure:

{
  "summary": "One-paragraph summary of what this agent does",
  "goals": [
    { "id": "goal_1", "description": "Primary goal description", "priority": "high" }
  ],
  "rules": [
    { "id": "rule_1", "description": "Rule or constraint the agent must follow", "category": "tone|boundary|process|compliance" }
  ],
  "conversationFlows": [
    {
      "id": "flow_1",
      "name": "Flow name (e.g., Appointment Booking)",
      "steps": ["Step 1 description", "Step 2 description"],
      "happyPath": "Description of the ideal outcome"
    }
  ],
  "dataCollection": [
    { "field": "Field name (e.g., email)", "required": true, "method": "How the agent collects it" }
  ],
  "boundaries": [
    { "id": "boundary_1", "description": "What the agent should NOT do or topics to avoid" }
  ],
  "escalationTriggers": [
    { "id": "esc_1", "trigger": "Condition that should trigger escalation", "action": "What the agent should do" }
  ],
  "potentialWeaknesses": [
    { "id": "weak_1", "description": "Potential gap or weakness in the prompt", "severity": "high|medium|low" }
  ]
}

Be thorough. If the prompt lacks information for a category, return an empty array for it.
Identify real weaknesses — things that could cause the agent to fail in production (missing error handling, vague instructions, no escalation path, etc.).`;
}
