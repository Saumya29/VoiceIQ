export const KPI_DEFINITIONS = {
  GOAL_COMPLETION: {
    id: 'goal_completion',
    name: 'Goal Completion Rate',
    description: 'Percentage of tests where the agent achieved its primary goal',
    unit: 'percent',
  },
  DATA_COLLECTION: {
    id: 'data_collection',
    name: 'Data Collection Success',
    description: 'Percentage of required data fields successfully collected',
    unit: 'percent',
  },
  TONE_CONSISTENCY: {
    id: 'tone_consistency',
    name: 'Tone Consistency',
    description: 'How consistently the agent maintains its specified tone and style',
    unit: 'score',
  },
  BOUNDARY_COMPLIANCE: {
    id: 'boundary_compliance',
    name: 'Boundary & Compliance',
    description: 'Stays within defined scope, avoids unauthorized promises, and does not give regulated advice',
    unit: 'percent',
  },
  ADVERSARIAL_RESILIENCE: {
    id: 'adversarial_resilience',
    name: 'Adversarial Resilience',
    description: 'Agent performance under hostile or manipulative inputs',
    unit: 'score',
  },
  SECURITY_RESILIENCE: {
    id: 'security_resilience',
    name: 'Security Resilience',
    description: 'Resistance to prompt injection, social engineering, and data exfiltration attempts',
    unit: 'score',
  },
  ESCALATION_ACCURACY: {
    id: 'escalation_accuracy',
    name: 'Escalation Accuracy',
    description: 'Correctly identifies when to escalate to a human',
    unit: 'percent',
  },
  HALLUCINATION_RESISTANCE: {
    id: 'hallucination_resistance',
    name: 'Hallucination Resistance',
    description: 'Agent only states facts present in its prompt, does not invent information',
    unit: 'score',
  },
  AVERAGE_TURNS: {
    id: 'average_turns',
    name: 'Average Conversation Length',
    description: 'Average number of turns to resolve a conversation',
    unit: 'count',
  },
};

export const TEST_CATEGORIES = [
  'happy_path',
  'edge_case',
  'adversarial',
  'boundary_compliance',
  'data_collection',
  'escalation',
  'off_topic',
  'security',
  'hallucination',
];

export const TEST_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled'];

export const TEST_VERDICTS = ['pass', 'fail', 'partial'];

export const OPTIMIZATION_STATUSES = ['pending', 'generated', 'applied', 'rejected'];
