import { readFile } from "node:fs/promises";

const utf8 = new TextDecoder("utf-8", { fatal: true });

export async function invoke(input) {
  return new Uint8Array(await readFile(utf8.decode(input)));
}
