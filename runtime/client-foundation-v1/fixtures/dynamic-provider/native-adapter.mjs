const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const identity = "wasmc:client-foundation-dynamic@0.0.1-dev.1";

export async function invoke(input) {
  const request = JSON.parse(decoder.decode(input));
  if (request.operation === "probe" || request.operation === "health") {
    return encoder.encode(JSON.stringify({
      accepted: true,
      provider: identity,
      api: "wasmc:client-foundation-block@0.0.1",
      mode: "dynamic-a-b-provider",
    }));
  }
  if (request.operation === "invoke") {
    return encoder.encode(JSON.stringify({
      accepted: true,
      provider: identity,
      value: `dynamic:${String(request.value ?? "")}`,
    }));
  }
  throw new Error(`unsupported dynamic operation ${JSON.stringify(request.operation)}`);
}
