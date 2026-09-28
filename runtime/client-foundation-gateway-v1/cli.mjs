#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { ClientFoundationGateway } from "./gateway.mjs";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`missing ${name}`);
  return value;
};
const positiveInteger = (name, fallback) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
};

const gateway = new ClientFoundationGateway({
  dataRoot: required("WASMC_GATEWAY_DATA_ROOT"),
  tlsKey: readFileSync(required("WASMC_GATEWAY_TLS_KEY")),
  tlsCert: readFileSync(required("WASMC_GATEWAY_TLS_CERT")),
  host: process.env.WASMC_GATEWAY_HOST ?? "127.0.0.1",
  port: Number(process.env.WASMC_GATEWAY_PORT ?? 8443),
  advertiseOrigin: process.env.WASMC_GATEWAY_ADVERTISE_ORIGIN ?? null,
  maxCompletedCommandsPerClient: positiveInteger("WASMC_GATEWAY_MAX_COMPLETED_COMMANDS", 128),
  heartbeatIntervalMs: positiveInteger("WASMC_GATEWAY_HEARTBEAT_INTERVAL_MS", 30000),
  heartbeatTimeoutMs: positiveInteger("WASMC_GATEWAY_HEARTBEAT_TIMEOUT_MS", 90000),
});

const address = await gateway.start();
console.log(JSON.stringify({ accepted: true, schema: "wasmc.client-foundation-gateway-start/v1", ...address }));
const stop = async () => {
  await gateway.close();
  process.exit(0);
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
