/**
 * BMW-FAST telegram framing for K+DCAN adapters (D-CAN concept 0x0110).
 *
 * Spec: D-CAN_TRANSPORT_RESEARCH.md §1.2 — verified against EdiabasLib
 * (CalcChecksumBmwFast / TelLengthBmwFast) and ediabasx (kwp2000.ts).
 *
 * Telegram: [0x80|len][TGT][SRC][data...][sum8] for len <= 0x3F, where
 * sum8 = (sum of all preceding bytes) & 0xFF. Long form (len > 0x3F):
 * [0x80][TGT][SRC][len_lo][data...][sum8], and for len >= 0x100:
 * [0x80][TGT][SRC][0x00][len_hi][len_lo][data...][sum8].
 */

export const TESTER_ADDRESS = 0xf1

export function checksum(bytes: Uint8Array): number {
  let sum = 0
  for (const b of bytes) sum = (sum + b) & 0xff
  return sum
}

export interface Telegram {
  target: number
  source: number
  data: Uint8Array
}

/** Builds a complete telegram (framing + checksum) ready for the wire. */
export function buildTelegram(target: number, data: Uint8Array, source = TESTER_ADDRESS): Uint8Array {
  const len = data.length
  if (len <= 0x3f) {
    const out = new Uint8Array(4 + len)
    out[0] = 0x80 | len
    out[1] = target
    out[2] = source
    out.set(data, 3)
    out[out.length - 1] = checksum(out.subarray(0, out.length - 1))
    return out
  }
  if (len <= 0xff) {
    const out = new Uint8Array(5 + len)
    out[0] = 0x80
    out[1] = target
    out[2] = source
    out[3] = len
    out.set(data, 4)
    out[out.length - 1] = checksum(out.subarray(0, out.length - 1))
    return out
  }
  const out = new Uint8Array(6 + len)
  out[0] = 0x80
  out[1] = target
  out[2] = source
  out[3] = 0x00
  out[4] = len >> 8
  out[5] = len & 0xff
  out.set(data, 6)
  out[out.length - 1] = checksum(out.subarray(0, out.length - 1))
  return out
}

/** Wire length of the telegram starting at `i`, or 0 if there isn't one. */
function telegramLength(buf: Uint8Array, i: number): number {
  const b0 = buf[i]
  if (b0 === undefined) return 0
  if (b0 === 0x80) {
    // long form: [0x80][tgt][src][len_lo] or [0x80][tgt][src][0x00][len_hi][len_lo]
    if (i + 4 >= buf.length) return 0
    const b3 = buf[i + 3]
    if (b3 === 0x00) {
      if (i + 6 > buf.length) return 0
      const len = (buf[i + 4] << 8) | buf[i + 5]
      return 7 + len
    }
    return 5 + b3
  }
  if ((b0 & 0xc0) === 0x80) {
    // short form: len = b0 & 0x3F (b0 in 0x81..0xBF)
    return 4 + (b0 & 0x3f)
  }
  return 0 // not a telegram start byte
}

export interface ParsedTelegram extends Telegram {
  /** total wire length of this telegram */
  wireLength: number
}

/**
 * Incremental parser: feed raw stream chunks, receive checksum-valid
 * telegrams. Every byte position is checked, so telegrams whose data
 * contain 0x8x bytes and broken-checksum noise are handled safely:
 * a position is accepted only when its checksum verifies.
 */
export class TelegramParser {
  private buf: Uint8Array = new Uint8Array(0)

  feed(chunk: Uint8Array): ParsedTelegram[] {
    const merged = new Uint8Array(this.buf.length + chunk.length)
    merged.set(this.buf)
    merged.set(chunk, this.buf.length)
    this.buf = merged

    const out: ParsedTelegram[] = []
    let consumed = 0 // bytes of this.buf covered by accepted telegrams
    let i = 0
    while (i < this.buf.length) {
      const b = this.buf[i]
      if ((b & 0xc0) !== 0x80) {
        i++
        continue
      }
      const len = telegramLength(this.buf, i)
      if (len === 0 || i + len > this.buf.length) {
        i++
        continue
      }
      const body = this.buf.subarray(i, i + len - 1)
      if (checksum(body) !== this.buf[i + len - 1]) {
        i++ // broken checksum — resync from the next byte
        continue
      }
      const isLong = b === 0x80
      const target = this.buf[i + 1]
      const source = this.buf[i + 2]
      const dataStart = isLong ? (this.buf[i + 3] === 0x00 ? 6 : 4) : 3
      const data = new Uint8Array(this.buf.subarray(i + dataStart, i + len - 1))
      out.push({ target, source, data, wireLength: len })
      i += len
      consumed = i
    }
    // keep only the unparsed tail (incomplete telegram waiting for more bytes)
    this.buf = this.buf.subarray(consumed)
    return out
  }
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/** Adapter commands (research §1.5): requests to the virtual ECU 0xF1.
 *  The command byte is sent twice: 82 F1 F1 FD FD sum. */
export function adapterCommand(code: number): Uint8Array {
  return buildTelegram(TESTER_ADDRESS, new Uint8Array([code, code]), TESTER_ADDRESS)
}

export const ADAPTER_GET_IGNITION = 0xfe
export const ADAPTER_GET_TYPE = 0xfd
export const ADAPTER_GET_SERIAL = 0xfb
export const ADAPTER_GET_VOLTAGE = 0xfc
