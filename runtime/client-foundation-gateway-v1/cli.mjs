#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { ClientFoundationGateway } from "./gateway.mjs";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`missing ${name}`);
  return value;
};

const gateway = new ClientFoundationGateway({
  dataRoot: required("WASMC_GATEWAY_DATA_ROOT"),
  tlsKey: readFileSync(required("WASMC_GATEWAY_TLS_KEY")),
  tlsCert: readFileSync(required("WASMC_GATEWAY_TLS_CERT")),
  host: process.env.WASMC_GATEWAY_HOST ?? "127.0.0.1",
  port: Number(process.env.WASMC_GATEWAY_PORT ?? 8443),
  advertiseOrigin: process.env.WASMC_GATEWAY_ADVERTISE_ORIGIN ?? null,
});

const address = await gateway.start();
console.log(JSON.stringify({ accepted: true, schema: "wasmc.client-foundation-gateway-start/v1", ...address }));
const stop = async () => {
  await gateway.close();
  process.exit(0);
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
