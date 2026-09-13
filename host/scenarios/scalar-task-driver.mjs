// Restricted scalar task ABI v0 driver. Not a typed resource SDK or promotion lane.
export async function driveScalarTask(step, input, effects, {signal} = {}) {
  const visited = new Set();
  let state = 0, event = 0, value = input;
  const cancelled = () => {if (signal?.aborted) throw Error('cancelled');};
  const scalar = value => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
  if (!scalar(input) || !Array.isArray(effects) || effects.length < 1 || effects.length > 8
      || effects.some(effect => typeof effect !== 'function')) throw Error('invalid-task-profile');
  for (let turns = 0; turns <= effects.length; turns++) {
    cancelled();
    const result = step(state, event, value);
    if (!Array.isArray(result) || result.length !== 3 || !result.every(scalar)) throw Error('malformed-transition');
    const [disposition, next, payload] = result;
    if (disposition === 1 && next === 0) return payload;
    if (disposition === 2) throw Error(`guest-failure:${payload}`);
    if (disposition !== 0 || next !== state + 1 || next > effects.length || visited.has(next)) throw Error('invalid-effect-transition');
    visited.add(next);
    // Await actual settlement even after cancellation; never resume/replay or
    // force-free an issued backend. Outer embedding owns cleanup/quarantine.
    value = await effects[next - 1](payload);
    cancelled();
    if (!scalar(value)) throw Error('invalid-effect-result');
    state = next; event = 1;
  }
  throw Error('task-transition-limit');
}
