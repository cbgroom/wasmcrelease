import assert from 'node:assert/strict';
import { guidanceSnapshot, validateGuidance } from './agent-guidance-contract.mjs';
const snapshot = await guidanceSnapshot(new URL('../', import.meta.url).pathname);
const result = validateGuidance(snapshot);
const reject = mutate => {
  const candidate = structuredClone(snapshot); mutate(candidate);
  assert.throws(() => validateGuidance(candidate), /agent.guidance_invalid/);
};
const tag=snapshot.release.tag;
reject(s => s.agents = s.agents.replace(`release is\n\`${tag}\``, 'release is\n`v0.0.0`'));
reject(s => s.agents = s.agents.replace(`## ${tag} capability`, '## v0.0.0 capability'));
reject(s => s.agents = s.agents.replace(`@${tag}/`, '@v0.0.0/'));
reject(s => s.agents = s.agents.replaceAll('standard/wasmc-std/1.4.0/', 'missing-standard/'));
reject(s => s.skills = s.skills.filter(row => !row.path.includes('skills/wasmc-lib/')));
reject(s => s.skills.push(s.skills[0]));
reject(s => { const row = s.skills.find(row => row.path.includes('skills/wasmc-lib/')); row.text = row.text.replace('name: wasmc-lib', 'name: wasmc-lib\nparent_skill: "wasmc-lib"'); });
reject(s => s.agents = s.agents.replace('skills/wasmc-sdk-discovery/SKILL.md', 'missing-sdk-discovery/SKILL.md'));
reject(s => s.skills = s.skills.filter(row => row.path !== 'sdk/wasmc-host/SKILL.md'));
reject(s => {
  const row = s.skills.find(row => row.path === 'skills/wasmc-sdk-discovery/SKILL.md');
  row.text = row.text.replace('sdk/wasmc-core-runtime/SKILL.md', 'sdk/missing-core-runtime/SKILL.md');
});
console.log(JSON.stringify({ ...result, negative_tests: 10 }));
