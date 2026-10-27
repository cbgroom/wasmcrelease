// These files are CI/governance metadata, never compiler or Cargo inputs.
// A narrower list for v031 permits the JSON successor's dedicated workflow;
// it does not permit arbitrary workflow or compiler source changes.
export function admissibleCompilerSourceDiff(version, changedPaths, sourceInputs) {
  if (!Array.isArray(changedPaths) || !Array.isArray(sourceInputs)) return false;
  const inputs = new Set(sourceInputs.map(row => row?.path));
  const jsonWorkflow = '.github/workflows/lib-memory-v031.yml';
  const permitsWorkflow = /^0\.0\.(?:3[1-9]|[4-9][0-9]|[1-9][0-9]{2,})$/.test(version);
  return changedPaths.every(path => typeof path === 'string' && !path.includes('\\') &&
    path.split('/').every(part => part && part !== '.' && part !== '..') && !inputs.has(path) &&
    (path.startsWith('.agents/') || (permitsWorkflow && path === jsonWorkflow)));
}
