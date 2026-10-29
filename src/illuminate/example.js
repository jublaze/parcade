import sourceExample from './example.json' with { type: 'json' };
import { normalizeQuiz } from './model.js';

const normalized = normalizeQuiz(sourceExample, { idFactory: () => 'illuminate-percentages-example' });
if (!normalized.valid) throw new Error(`Bundled Illuminate example is invalid: ${normalized.error}`);

export const EXAMPLE_QUIZ = normalized.quiz;
export const EXAMPLE_JSON = JSON.stringify(sourceExample, null, 2);
