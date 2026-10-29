import test from 'node:test';
import assert from 'node:assert/strict';
import { MATH_SOURCE } from '../src/settings.js';
import { createQuestion, createSetupState, expireMathRun, pauseMathRun, resumeMathRun, startMathRun, submitMathAnswer } from '../src/math-ladder/game.js';

const constant = (value) => () => value;
const config = (overrides = {}) => ({ ...MATH_SOURCE, ...overrides });

test('source addition samples operands from 1 through 10^digits - 1', () => {
  const question = createQuestion(config({ digits: 2 }), () => 0);
  assert.deepEqual(question, { operation: 'addition', a: 1, b: 1, answer: 2, prompt: '1 + 1 =' });
  const upper = createQuestion(config({ digits: 2 }), () => 0.99999);
  assert.deepEqual([upper.a, upper.b], [99, 99]);
});

test('subtraction sorts operands and supports zero through the custom range', () => {
  const question = createQuestion(config({ operations: ['subtraction'], customRangeEnabled: true, operandMin: 0, operandMax: 9 }), (() => { const values = [0, 0.99, 0]; return () => values.shift(); })());
  assert.deepEqual([question.a, question.b, question.answer, question.prompt], [9, 0, 9, '9 − 0 =']);
  const zero = createQuestion(config({ operations: ['subtraction'], customRangeEnabled: true, operandMin: 0, operandMax: 0 }), constant(0));
  assert.equal(zero.answer, 0);
});

test('source multiplication at three or four digits stays within the 2–99 factor cap', () => {
  const question = createQuestion(config({ operations: ['multiplication'], digits: 4 }), (() => { const values = [0, 0, 0.99999]; return () => values.shift(); })());
  assert.deepEqual([question.a, question.b, question.answer], [2, 99, 198]);
});

test('custom operand range overrides the source multiplication cap and accepts zero', () => {
  const question = createQuestion(config({ operations: ['multiplication'], digits: 4, customRangeEnabled: true, operandMin: 1000, operandMax: 9999 }), constant(0));
  assert.deepEqual([question.a, question.b, question.answer], [1000, 1000, 1000000]);
});

test('mixed operations are selected from the configured set', () => {
  const question = createQuestion(config({ operations: ['addition', 'subtraction', 'multiplication'] }), constant(0.99));
  assert.equal(question.operation, 'multiplication');
});

test('blank and invalid answers do not advance, while correct and wrong answers advance one rung', () => {
  const run = startMathRun(config(), constant(0));
  assert.equal(submitMathAnswer(run, '   ').rung, 0);
  const invalid = submitMathAnswer(run, '1.2');
  assert.equal(invalid.feedback, 'Numbers only'); assert.equal(invalid.wrong, 0); assert.equal(invalid.rung, 0);
  const correct = submitMathAnswer(run, String(run.question.answer), { random: constant(0) });
  assert.equal(correct.rung, 1); assert.equal(correct.feedback, 'Correct!'); assert.equal(correct.status, 'running');
  const wrong = submitMathAnswer(correct, String(correct.question.answer + 1), { random: constant(0) });
  assert.equal(wrong.rung, 1); assert.equal(wrong.wrong, 1); assert.equal(wrong.feedback, 'Wrong. New question.');
});

test('win and wrong-answer terminal states trigger once and reject further submissions', () => {
  let run = startMathRun(config({ correctToWin: 2 }), constant(0));
  run = submitMathAnswer(run, String(run.question.answer), { random: constant(0) });
  run = submitMathAnswer(run, String(run.question.answer), { random: constant(0) });
  assert.equal(run.status, 'won'); assert.equal(run.rung, 2); assert.equal(run.endReason, 'win');
  assert.equal(submitMathAnswer(run, 'wrong').status, 'won');

  let missed = startMathRun(config({ wrongToLose: 1 }), constant(0));
  missed = submitMathAnswer(missed, String(missed.question.answer + 1));
  assert.equal(missed.status, 'lost'); assert.equal(missed.wrong, 1); assert.equal(missed.endReason, 'wrong');
});

test('deadline expiry takes precedence over a correct answer and terminal time cannot restart', () => {
  const run = startMathRun(config({ timeLimitSeconds: 5 }), constant(0));
  const ended = submitMathAnswer(run, String(run.question.answer), { elapsedMs: 5000 });
  assert.equal(ended.status, 'lost'); assert.equal(ended.endReason, 'time'); assert.equal(ended.rung, 0);
  assert.equal(expireMathRun(ended, 6000), ended);
});

test('pause and resume are explicit and a fresh setup carries the applied config', () => {
  const run = startMathRun(config(), constant(0));
  const paused = pauseMathRun(run);
  assert.equal(paused.status, 'paused'); assert.equal(pauseMathRun(paused), paused);
  assert.equal(resumeMathRun(paused).status, 'running');
  assert.deepEqual(createSetupState(run.config), { status: 'setup', config: run.config, rung: 0, wrong: 0, question: null, feedback: '', endReason: null });
});

test('run configuration is deeply immutable after applying settings', () => {
  const applied = config({ operations: ['addition', 'subtraction'] });
  const run = startMathRun(applied, constant(0));
  assert.notEqual(run.config.operations, applied.operations);
  assert.equal(Object.isFrozen(run.config), true);
  assert.equal(Object.isFrozen(run.config.operations), true);
  assert.throws(() => run.config.operations.push('multiplication'), TypeError);
  assert.deepEqual(run.config.operations, ['addition', 'subtraction']);
});
