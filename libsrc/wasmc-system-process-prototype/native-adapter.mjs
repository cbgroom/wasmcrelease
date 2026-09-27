import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const utf8 = new TextDecoder("utf-8", { fatal: true });

const decodeStrings = (input) => {
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  let cursor = 0;
  const takeU32 = () => {
    if (cursor + 4 > input.length) throw new Error("truncated string vector");
    const value = view.getUint32(cursor, true);
    cursor += 4;
    return value;
  };
  const count = takeU32();
  const values = [];
  for (let index = 0; index < count; index += 1) {
    const length = takeU32();
    if (cursor + length > input.length) throw new Error("truncated string");
    values.push(utf8.decode(input.subarray(cursor, cursor + length)));
    cursor += length;
  }
  if (cursor !== input.length || values.length === 0) throw new Error("invalid process request");
  return values;
};

export async function invoke(input, { signal }) {
  const [executable, ...arguments_] = decodeStrings(input);
  const { stdout } = await exec(executable, arguments_, { encoding: "buffer", signal, maxBuffer: 1024 * 1024 });
  return new Uint8Array(stdout);
}
