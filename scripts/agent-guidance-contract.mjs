import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Public guidance only: maintainer Skills are not consumer dependencies.
export async function guidanceSnapshot(root) {
  const skills = [];
  async function walk(dir) {
    for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name === 'SKILL.md') skills.push({ path, text: await readFile(join(root, path), 'utf8') });
    }
  }
  await walk('skills'); await walk('standard'); await walk('libs');
  return { agents: await readFile(join(root, 'AGENTS.md'), 'utf8'), release: JSON.parse(await readFile(join(root, 'release.json'), 'utf8')), skills };
}

export function validateGuidance({ agents, release, skills }) {
  const fail = message => { throw Error(`agent.guidance_invalid: ${message}`); };
  const declared = agents.match(/current immutable release is\s*`([^`]+)`/i)?.[1];
  if (declared !== release.tag) fail('root release identity is stale or missing');
  const headings = [...agents.matchAll(/^## (v[^\s]+) capability contract$/gm)].map(m => m[1]);
  if (headings.length !== 1 || headings[0] !== release.tag) fail('capability contract identity differs');
  const cdn = [...agents.matchAll(/cdn\.jsdelivr\.net\/gh\/cbgroom\/wasmcrelease@(v[^/\s]+)\//g)].map(m => m[1]);
  if (!cdn.length || cdn.some(tag => tag !== release.tag)) fail('root CDN release identity differs');
  const standardSkills = skills.filter(row => row.path.startsWith('standard/') && row.path.endsWith('/SKILL.md'));
  if (!standardSkills.length || standardSkills.some(row => !agents.includes(row.path.slice(0, -8)))) fail('standard package discovery route missing');
  const names = new Map();
  for (const skill of skills) {
    const frontmatter = skill.text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
    const name = frontmatter?.match(/^name:\s*["']?([^\s"']+)["']?\s*$/m)?.[1];
    if (!name || names.has(name)) fail(`missing or ambiguous public Skill identity: ${skill.path}`);
    names.set(name, skill);
  }
  const parents = new Map();
  for (const [name, skill] of names) {
    const frontmatter = skill.text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
    const parent = frontmatter?.match(/^\s*parent_skill:\s*["']?([^\s"']+)["']?\s*$/m)?.[1];
    if (parent && !names.has(parent)) fail(`missing parent Skill ${parent} from ${skill.path}`);
    if (parent) parents.set(name, parent);
  }
  for (const name of names.keys()) {
    const seen = new Set(); let current = name;
    while (parents.has(current)) {
      if (seen.has(current)) fail(`parent Skill cycle: ${name}`);
      seen.add(current); current = parents.get(current);
    }
  }
  return { accepted: true, release_tag: release.tag, public_skills: names.size, parent_edges: parents.size };
}
