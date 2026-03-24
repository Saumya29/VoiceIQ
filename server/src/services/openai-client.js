import OpenAI from 'openai';
import { config } from '../config/env.js';

const client = new OpenAI({ apiKey: config.openai.apiKey });

const OpenAIClient = {
  async complete(prompt, { model = config.openai.agentModel, temperature = 0.3, maxTokens = 2000 } = {}) {
    const res = await client.chat.completions.create({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    return res.choices[0].message.content;
  },

  async completeJson(prompt, { model = config.openai.agentModel, temperature = 0.3, maxTokens = 4000 } = {}) {
    const res = await client.chat.completions.create({
      model,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
    });
    return JSON.parse(res.choices[0].message.content);
  },

  async chat(messages, { model = config.openai.agentModel, temperature = 0.3, maxTokens = 1000 } = {}) {
    const res = await client.chat.completions.create({
      model,
      temperature,
      max_tokens: maxTokens,
      messages,
    });
    return res.choices[0].message.content;
  },
};

export default OpenAIClient;
