import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMultiplicationQuiz, MULTIPLICATION_MODES } from '../src/illuminate/multiplication.js';

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function factsFor(quiz) {
  return quiz.questions.map(({ prompt }) => prompt.match(/^(\d+) × (\d+) = \?$/).slice(1).map(Number));
}

test('one-digit multiplication round has ten exact unique commutative facts in range', () => {
  const quiz = generateMultiplicationQuiz(MULTIPLICATION_MODES.oneDigit.id, seededRandom(10));
  assert.equal(quiz.questions.length, 10);
  assert.equal(quiz.time_limit_seconds, 0);
  assert.deepEqual(quiz.questions.map(({ id }) => id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const facts = factsFor(quiz);
  assert.ok(facts.every(([left, right]) => left >= 1 && left <= 9 && right >= 1 && right <= 9));
  assert.equal(new Set(facts.map(([left, right]) => [Math.min(left, right), Math.max(left, right)].join('×'))).size, 10);
  quiz.questions.forEach(({ prompt, answer }) => {
    const [, left, right] = prompt.match(/^(\d+) × (\d+) = \?$/);
    assert.equal(answer, Number(left) * Number(right));
  });
  assert.ok(Object.isFrozen(quiz) && Object.isFrozen(quiz.questions) && Object.isFrozen(quiz.questions[0]));
});

test('one-digit by two-digit multiplication uses inclusive bounds and ten unique exact facts', () => {
  const quiz = generateMultiplicationQuiz(MULTIPLICATION_MODES.twoDigit.id, seededRandom(20));
  const facts = factsFor(quiz);
  assert.equal(facts.length, 10);
  assert.ok(facts.every(([left, right]) => left >= 1 && left <= 9 && right >= 10 && right <= 99));
  assert.equal(new Set(facts.map(([left, right]) => `${left}×${right}`)).size, 10);
  quiz.questions.forEach(({ prompt, answer }) => {
    const [, left, right] = prompt.match(/^(\d+) × (\d+) = \?$/);
    assert.equal(answer, Number(left) * Number(right));
  });
});

test('new rounds use fresh shuffled fact sets with injected random sources', () => {
  for (const mode of [MULTIPLICATION_MODES.oneDigit.id, MULTIPLICATION_MODES.twoDigit.id]) {
    const first = generateMultiplicationQuiz(mode, seededRandom(1));
    const next = generateMultiplicationQuiz(mode, seededRandom(2));
    assert.notDeepEqual(first.questions, next.questions);
  }
});

test('deterministic shuffles reach the minimum and maximum factors in both modes', () => {
  const identityShuffle = () => 0.9999999999999999;
  const lastFactFirst = () => {
    let first = true;
    return () => { if (first) { first = false; return 0; } return 0.9999999999999999; };
  };
  const oneLow = new Set(factsFor(generateMultiplicationQuiz(MULTIPLICATION_MODES.oneDigit.id, identityShuffle)).map(([a, b]) => `${a}×${b}`));
  const oneHigh = new Set(factsFor(generateMultiplicationQuiz(MULTIPLICATION_MODES.oneDigit.id, lastFactFirst())).map(([a, b]) => `${a}×${b}`));
  const twoLow = new Set(factsFor(generateMultiplicationQuiz(MULTIPLICATION_MODES.twoDigit.id, identityShuffle)).map(([a, b]) => `${a}×${b}`));
  const twoHigh = new Set(factsFor(generateMultiplicationQuiz(MULTIPLICATION_MODES.twoDigit.id, lastFactFirst())).map(([a, b]) => `${a}×${b}`));
  assert.ok(oneLow.has('1×1')); assert.ok(oneHigh.has('9×9'));
  assert.ok(twoLow.has('1×10')); assert.ok(twoHigh.has('9×99'));
});

test('one-digit fact orientation is an independent fair draw after fact selection', () => {
  function oriented(coin) {
    let calls = 0;
    return generateMultiplicationQuiz(MULTIPLICATION_MODES.oneDigit.id, () => {
      calls += 1;
      return calls <= 44 ? 0.9999999999999999 : coin;
    });
  }
  const reverse = oriented(0);
  const forward = oriented(0.9999999999999999);
  const reverseFacts = factsFor(reverse);
  const forwardFacts = factsFor(forward);
  const canonical = (facts) => facts.map(([a, b]) => [Math.min(a, b), Math.max(a, b)].join('×'));
  assert.deepEqual(canonical(reverseFacts), canonical(forwardFacts));
  assert.equal(new Set(canonical(reverseFacts)).size, 10);
  reverseFacts.forEach(([left, right], index) => {
    if (left !== right) assert.deepEqual([left, right], [...forwardFacts[index]].reverse());
    assert.equal(reverse.questions[index].answer, left * right);
    assert.equal(forward.questions[index].answer, forwardFacts[index][0] * forwardFacts[index][1]);
  });
});

test('unsupported practice modes and invalid random values fail clearly', () => {
  assert.throws(() => generateMultiplicationQuiz('division'), /supported multiplication/);
  assert.throws(() => generateMultiplicationQuiz(MULTIPLICATION_MODES.oneDigit.id, () => 1), /Random source/);
});
