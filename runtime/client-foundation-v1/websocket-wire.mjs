import { randomBytes } from "node:crypto";

export function encodeFrame(payload, { mask = false, opcode = 0x1 } = {}) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const extended = body.length < 126 ? 0 : body.length <= 0xffff ? 2 : 8;
  const maskBytes = mask ? 4 : 0;
  const frame = Buffer.allocUnsafe(2 + extended + maskBytes + body.length);
  frame[0] = 0x80 | opcode;
  let offset = 2;
  if (extended === 0) {
    frame[1] = (mask ? 0x80 : 0) | body.length;
  } else if (extended === 2) {
    frame[1] = (mask ? 0x80 : 0) | 126;
    frame.writeUInt16BE(body.length, offset);
    offset += 2;
  } else {
    if (!Number.isSafeInteger(body.length)) throw new Error("WebSocket payload is too large");
    frame[1] = (mask ? 0x80 : 0) | 127;
    frame.writeBigUInt64BE(BigInt(body.length), offset);
    offset += 8;
  }
  if (!mask) {
    body.copy(frame, offset);
    return frame;
  }
  const key = randomBytes(4);
  key.copy(frame, offset);
  offset += 4;
  for (let index = 0; index < body.length; index += 1) {
    frame[offset + index] = body[index] ^ key[index % 4];
  }
  return frame;
}

export class FrameDecoder {
  #buffer = Buffer.alloc(0);

  constructor({ expectMasked, maxPayload = 1024 * 1024 } = {}) {
    this.expectMasked = expectMasked;
    this.maxPayload = maxPayload;
  }

  push(chunk) {
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    const frames = [];
    while (this.#buffer.length >= 2) {
      const first = this.#buffer[0];
      const second = this.#buffer[1];
      if ((first & 0x70) !== 0) throw new Error("unsupported WebSocket extension bits");
      if ((first & 0x80) === 0) throw new Error("fragmented WebSocket frames are unsupported");
      const opcode = first & 0x0f;
      const masked = (second & 0x80) !== 0;
      if (this.expectMasked !== undefined && masked !== this.expectMasked) {
        throw new Error(masked ? "unexpected masked frame" : "expected masked frame");
      }
      let length = second & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (this.#buffer.length < 4) break;
        length = this.#buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (this.#buffer.length < 10) break;
        const wide = this.#buffer.readBigUInt64BE(2);
        if (wide > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("WebSocket payload is too large");
        length = Number(wide);
        offset = 10;
      }
      if (length > this.maxPayload) throw new Error("WebSocket payload limit");
      const maskOffset = masked ? 4 : 0;
      const total = offset + maskOffset + length;
      if (this.#buffer.length < total) break;
      const key = masked ? this.#buffer.subarray(offset, offset + 4) : null;
      offset += maskOffset;
      const payload = Buffer.from(this.#buffer.subarray(offset, offset + length));
      if (key) {
        for (let index = 0; index < payload.length; index += 1) payload[index] ^= key[index % 4];
      }
      this.#buffer = this.#buffer.subarray(total);
      frames.push({ opcode, payload });
    }
    return frames;
  }
}
