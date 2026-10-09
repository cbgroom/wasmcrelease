// Capability evidence and channel publication remain separate authorities.
export function publishedLifecycle(release, prod, candidate, version) {
  const released = release.version === version && prod.version === version &&
    release.stage === 'prod' && prod.stage === 'prod' &&
    release.tag === `v${version}` && prod.tag === release.tag &&
    prod.product_candidate_commit === release.product_candidate_commit &&
    prod.product_set_sha256 === candidate.product_set_sha256 &&
    prod.qualification?.accepted === true &&
    prod.qualification.tested_product_set_sha256 === candidate.product_set_sha256;
  return { qualified: true, admitted: released, released, discoverable: released, installable: released };
}
