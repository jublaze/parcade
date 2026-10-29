export const MULTIPLICATION_MODES = Object.freeze({
  oneDigit: Object.freeze({ id: 'one-digit', title: '1-digit × 1-digit', shortTitle: '1-digit × 1-digit' }),
  twoDigit: Object.freeze({ id: 'two-digits', title: '1-digit × 2-digits', shortTitle: '1-digit × 2-digits' }),
});

export function generateMultiplicationQuiz(mode, random = Math.random) {
  const oneByOne = mode === MULTIPLICATION_MODES.oneDigit.id;
  const oneByTwo = mode === MULTIPLICATION_MODES.twoDigit.id;
  if (!oneByOne && !oneByTwo) throw new RangeError('Choose a supported multiplication practice mode.');

  const facts = [];
  if (oneByOne) {
    for (let left = 1; left <= 9; left += 1) {
      for (let right = left; right <= 9; right += 1) facts.push([left, right]);
    }
  } else {
    for (let left = 1; left <= 9; left += 1) {
      for (let right = 10; right <= 99; right += 1) facts.push([left, right]);
    }
  }

  for (let index = facts.length - 1; index > 0; index -= 1) {
    const draw = random();
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new RangeError('Random source must return values from 0 inclusive to 1 exclusive.');
    const selected = Math.floor(draw * (index + 1));
    [facts[index], facts[selected]] = [facts[selected], facts[index]];
  }

  const selectedFacts = facts.slice(0, 10);
  const questions = selectedFacts.map(([first, second], index) => {
    let left = first;
    let right = second;
    if (oneByOne && first !== second) {
      const orientation = random();
      if (!Number.isFinite(orientation) || orientation < 0 || orientation >= 1) {
        throw new RangeError('Random source must return values from 0 inclusive to 1 exclusive.');
      }
      if (orientation < 0.5) [left, right] = [right, left];
    }
    return Object.freeze({
    id: index + 1,
    skill: 'Multiplication',
    prompt: `${left} × ${right} = ?`,
    type: 'numeric',
    answer: left * right,
    unit: '',
    tolerance: 0,
    });
  });
  const descriptor = oneByOne ? MULTIPLICATION_MODES.oneDigit : MULTIPLICATION_MODES.twoDigit;
  return Object.freeze({
    quiz_id: `practice-multiplication-${mode}`,
    title: `Multiplication · ${descriptor.title}`,
    time_limit_seconds: 0,
    questions: Object.freeze(questions),
  });
}
