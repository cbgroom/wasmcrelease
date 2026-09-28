const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const identity = "wasmc:client-foundation-broken@0.0.1-dev.1";
let healthChecks = 0;

export async function invoke(input) {
  const request = JSON.parse(decoder.decode(input));
  if (request.operation === "probe") {
    return encoder.encode(JSON.stringify({
      accepted: true,
      provider: identity,
      api: "wasmc:client-foundation-block@0.0.1",
      mode: "passes-probe-fails-post-activation-health",
    }));
  }
  if (request.operation === "health") {
    healthChecks += 1;
    if (healthChecks === 1) {
      return encoder.encode(JSON.stringify({ accepted: true, provider: identity }));
    }
    throw new Error("intentional post-activation health failure");
  }
  if (request.operation === "invoke") {
    return encoder.encode(JSON.stringify({ accepted: false, provider: identity }));
  }
  throw new Error(`unsupported broken operation ${JSON.stringify(request.operation)}`);
}
