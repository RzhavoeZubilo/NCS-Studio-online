/**
 * Decoder for BMW EDIABAS .prg (BEST/1) ECU description files.
 *
 * TypeScript port of BimmerDaten's decoderPrg.py (itself a port of
 * BimmerDis C++ by radelbro, based on EdiabasLib — GPL-3.0).
 *
 * File layout: a plaintext "@EDIABAS OBJECT" magic, then a 0x9C-byte header
 * of int32 little-endian section pointers, followed by XOR-0xF7-encrypted
 * sections (info, comments, uses, tables, job list) and BEST/1 bytecode.
 */

export interface PrgInfo {
  bipVersion: string
  revision: string
  lastChanged: string
  author: string
  packageVersion: string
}

export interface PrgTable {
  name: string
  columns: string[]
  rows: string[][]
}

export interface PrgJob {
  name: string
  address: number
  comments: string[]
  disassembly: string[]
}

export interface PrgFile {
  info: PrgInfo
  uses: string[]
  ssize: number
  tables: PrgTable[]
  jobs: PrgJob[]
}

const XOR_KEY = 0xf7
const HEADER_SIZE = 0x9c

/** OpArg register table (register kind + number -> name). */
const OA_NAMES: Record<number, string> = {
  0x00: 'B0', 0x01: 'B1', 0x02: 'B2', 0x03: 'B3',
  0x04: 'B4', 0x05: 'B5', 0x06: 'B6', 0x07: 'B7',
  0x08: 'B8', 0x09: 'B9', 0x0a: 'BA', 0x0b: 'BB',
  0x0c: 'BC', 0x0d: 'BD', 0x0e: 'BE', 0x0f: 'BF',
  0x10: 'I0', 0x11: 'I1', 0x12: 'I2', 0x13: 'I3',
  0x14: 'I4', 0x15: 'I5', 0x16: 'I6', 0x17: 'I7',
  0x18: 'L0', 0x19: 'L1', 0x1a: 'L2', 0x1b: 'L3',
  0x1c: 'S0', 0x1d: 'S1', 0x1e: 'S2', 0x1f: 'S3',
  0x20: 'S4', 0x21: 'S5', 0x22: 'S6', 0x23: 'S7',
  0x24: 'F0', 0x25: 'F1', 0x26: 'F2', 0x27: 'F3',
  0x28: 'F4', 0x29: 'F5', 0x2a: 'F6', 0x2b: 'F7',
  0x2c: 'S8', 0x2d: 'S9', 0x2e: 'SA', 0x2f: 'SB',
  0x30: 'SC', 0x31: 'SD', 0x32: 'SE', 0x33: 'SF',
  0x80: 'A0', 0x81: 'A1', 0x82: 'A2', 0x83: 'A3',
  0x84: 'A4', 0x85: 'A5', 0x86: 'A6', 0x87: 'A7',
  0x88: 'A8', 0x89: 'A9', 0x8a: 'AA', 0x8b: 'AB',
  0x8c: 'AC', 0x8d: 'AD', 0x8e: 'AE', 0x8f: 'AF',
  0x90: 'I8', 0x91: 'I9', 0x92: 'IA', 0x93: 'IB',
  0x94: 'IC', 0x95: 'ID', 0x96: 'IE', 0x97: 'IF',
  0x98: 'L4', 0x99: 'L5', 0x9a: 'L6', 0x9b: 'L7',
}

/** Opcode table: code -> [mnemonic, arg0 is a near address]. */
const OP_CODES: Record<number, [string, boolean]> = {
  0x00: ['move', false], 0x01: ['clear', false], 0x02: ['comp', false],
  0x03: ['subb', false], 0x04: ['adds', false], 0x05: ['mult', false],
  0x06: ['divs', false], 0x07: ['and', false], 0x08: ['or', false],
  0x09: ['xor', false], 0x0a: ['not', false], 0x0b: ['jump', true],
  0x0c: ['jtsr', true], 0x0d: ['ret', false], 0x0e: ['jc', true],
  0x0f: ['jae', true], 0x10: ['jz', true], 0x11: ['jnz', true],
  0x12: ['jv', true], 0x13: ['jnv', true], 0x14: ['jmi', true],
  0x15: ['jpl', true], 0x16: ['clrc', false], 0x17: ['setc', false],
  0x18: ['asr', false], 0x19: ['lsl', false], 0x1a: ['lsr', false],
  0x1b: ['asl', false], 0x1c: ['nop', false], 0x1d: ['eoj', false],
  0x1e: ['push', false], 0x1f: ['pop', false], 0x20: ['scmp', false],
  0x21: ['scat', false], 0x22: ['scut', false], 0x23: ['slen', false],
  0x24: ['spaste', false], 0x25: ['serase', false], 0x26: ['xconnect', false],
  0x27: ['xhangup', false], 0x28: ['xsetpar', false], 0x29: ['xawlen', false],
  0x2a: ['xsend', false], 0x2b: ['xsendf', false], 0x2c: ['xrequf', false],
  0x2d: ['xstopf', false], 0x2e: ['xkeyb', false], 0x2f: ['xstate', false],
  0x30: ['xboot', false], 0x31: ['xreset', false], 0x32: ['xtype', false],
  0x33: ['xvers', false], 0x34: ['ergb', false], 0x35: ['ergw', false],
  0x36: ['ergd', false], 0x37: ['ergi', false], 0x38: ['ergr', false],
  0x39: ['ergs', false], 0x3a: ['a2flt', false], 0x3b: ['fadd', false],
  0x3c: ['fsub', false], 0x3d: ['fmul', false], 0x3e: ['fdiv', false],
  0x3f: ['ergy', false], 0x40: ['enewset', false], 0x41: ['etag', true],
  0x42: ['xreps', false], 0x43: ['gettmr', false], 0x44: ['settmr', false],
  0x45: ['sett', false], 0x46: ['clrt', false], 0x47: ['jt', true],
  0x48: ['jnt', true], 0x49: ['addc', false], 0x4a: ['subc', false],
  0x4b: ['break', false], 0x4c: ['clrv', false], 0x4d: ['eerr', false],
  0x4e: ['popf', false], 0x4f: ['pushf', false], 0x50: ['atsp', false],
  0x51: ['swap', false], 0x52: ['setspc', false], 0x53: ['srevrs', false],
  0x54: ['stoken', false], 0x55: ['parb', false], 0x56: ['parw', false],
  0x57: ['parl', false], 0x58: ['pars', false], 0x59: ['fclose', false],
  0x5a: ['jg', true], 0x5b: ['jge', true], 0x5c: ['jl', true],
  0x5d: ['jle', true], 0x5e: ['ja', true], 0x5f: ['jbe', true],
  0x60: ['fopen', false], 0x61: ['fread', false], 0x62: ['freadln', false],
  0x63: ['fseek', false], 0x64: ['fseekln', false], 0x65: ['ftell', false],
  0x66: ['ftellln', false], 0x67: ['a2fix', false], 0x68: ['fix2flt', false],
  0x69: ['parr', false], 0x6a: ['test', false], 0x6b: ['wait', false],
  0x6c: ['date', false], 0x6d: ['time', false], 0x6e: ['xbatt', false],
  0x6f: ['tosp', false], 0x70: ['xdownl', false], 0x71: ['xgetport', false],
  0x72: ['xignit', false], 0x73: ['xloopt', false], 0x74: ['xprog', false],
  0x75: ['xraw', false], 0x76: ['xsetport', false], 0x77: ['xsireset', false],
  0x78: ['xstoptr', false], 0x79: ['fix2hex', false], 0x7a: ['fix2dez', false],
  0x7b: ['tabset', false], 0x7c: ['tabseek', false], 0x7d: ['tabget', false],
  0x7e: ['strcat', false], 0x7f: ['pary', false], 0x80: ['parn', false],
  0x81: ['ergc', false], 0x82: ['ergl', false], 0x83: ['tabline', false],
  0x84: ['xsendr', false], 0x85: ['xrecv', false], 0x86: ['xinfo', false],
  0x87: ['flt2a', false], 0x88: ['setflt', false], 0x89: ['cfgig', false],
  0x8a: ['cfgsg', false], 0x8b: ['cfgis', false], 0x8c: ['a2y', false],
  0x8d: ['xparraw', false], 0x8e: ['hex2y', false], 0x8f: ['strcmp', false],
  0x90: ['strlen', false], 0x91: ['y2bcd', false], 0x92: ['y2hex', false],
  0x93: ['shmset', false], 0x94: ['shmget', false], 0x95: ['ergsysi', false],
  0x96: ['flt2fix', false], 0x97: ['iupdate', false], 0x98: ['irange', false],
  0x99: ['iincpos', false], 0x9a: ['tabseeku', false], 0x9b: ['flt2y4', false],
  0x9c: ['flt2y8', false], 0x9d: ['y42flt', false], 0x9e: ['y82flt', false],
  0x9f: ['plink', false], 0xa0: ['pcall', false], 0xa1: ['fcomp', false],
  0xa2: ['plinkv', false], 0xa3: ['ppush', false], 0xa4: ['ppop', false],
  0xa5: ['ppushflt', false], 0xa6: ['ppopflt', false], 0xa7: ['ppushy', false],
  0xa8: ['ppopy', false], 0xa9: ['pjtsr', false], 0xaa: ['tabsetex', false],
  0xab: ['ufix2dez', false], 0xac: ['generr', false], 0xad: ['ticks', false],
  0xae: ['waitex', false], 0xaf: ['xopen', false], 0xb0: ['xclose', false],
  0xb1: ['xcloseex', false], 0xb2: ['xswitch', false], 0xb3: ['xsendex', false],
  0xb4: ['xrecvex', false], 0xb5: ['ssize', false], 0xb6: ['tabcols', false],
  0xb7: ['tabrows', false],
}

function hex2(b: number): string {
  return b.toString(16).toUpperCase().padStart(2, '0')
}

/** Python-style f"{val:0{width}X}" (sign consumes part of the width). */
function pyHex(val: number, width: number): string {
  if (val < 0) return '-' + (-val).toString(16).toUpperCase().padStart(width - 1, '0')
  return val.toString(16).toUpperCase().padStart(width, '0')
}

function addr8(val: number): string {
  return pyHex(val, 8)
}

function latin1(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return s
}

function readNullString(bytes: Uint8Array): string {
  let end = bytes.indexOf(0)
  if (end === -1) end = bytes.length
  return latin1(bytes.subarray(0, end))
}

interface OpArg {
  text: string
  next: number
  /** Raw value for Imm32 mode (used for branch label computation). */
  raw32?: number
}

class PrgParser {
  private raw: Uint8Array
  private view: DataView

  constructor(data: Uint8Array) {
    this.raw = data
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  }

  private decBytes(offset: number, count: number): Uint8Array {
    const out = new Uint8Array(count)
    for (let i = 0; i < count; i++) out[i] = (this.raw[offset + i] ?? 0) ^ XOR_KEY
    return out
  }

  private int32Raw(offset: number): number {
    return this.view.getInt32(offset, true)
  }

  private headerInt32(offset: number): number {
    if (offset + 4 > HEADER_SIZE) {
      throw new Error(`Header pointer out of range: 0x${offset.toString(16)}`)
    }
    return this.view.getInt32(offset, true)
  }

  // --- Sections ---

  private parseInfo(): PrgInfo {
    const infoOffset = this.headerInt32(0x94)
    const d = this.decBytes(infoOffset, 0x6c)
    const dv = new DataView(d.buffer)
    const bip = `${hex2(d[2])}.${hex2(d[1])}.${hex2(d[0])}`
    const rev1 = dv.getInt16(0x06, true)
    const rev2 = dv.getInt16(0x04, true)
    return {
      bipVersion: bip,
      revision: `${rev1}.${rev2}`,
      lastChanged: readNullString(d.subarray(0x48, 0x48 + 0x24)),
      author: readNullString(d.subarray(0x08, 0x08 + 0x40)),
      packageVersion: pyHex(dv.getUint32(0x68, true), 8),
    }
  }

  private parseDescription(): Map<string, string[]> {
    const start = this.headerInt32(0x90)
    const comments = new Map<string, string[]>()
    if (start === -1) return comments

    const numBytes = this.int32Raw(start)
    let offset = start + 4
    let currentJob = ''
    let commentList: string[] = []
    let record: number[] = []

    for (let i = 0; i < numBytes; i++) {
      record.push((this.raw[offset++] ?? 0) ^ XOR_KEY)
      if (record.length >= 1098) record.push(10)
      if (record[record.length - 1] === 10) {
        const line = latin1(new Uint8Array(record.slice(0, -1)))
        if (line.startsWith('JOBNAME:')) {
          comments.set(currentJob, commentList)
          commentList = []
          currentJob = line.slice(8)
        }
        commentList.push(line)
        record = []
      }
    }
    comments.set(currentJob, commentList)
    return comments
  }

  private parseUses(): string[] {
    const usesOffset = this.headerInt32(0x7c)
    const count = this.int32Raw(usesOffset)
    let offset = usesOffset + 4
    const uses: string[] = []
    for (let i = 0; i < count; i++) {
      uses.push(readNullString(this.decBytes(offset, 0x100)))
      offset += 0x100
    }
    return uses
  }

  private parseSsize(): number {
    return this.headerInt32(0x18)
  }

  private readCString(ptr: number): { text: string; next: number } {
    const bytes: number[] = []
    for (let i = 0; i < 1024; i++) {
      const b = (this.raw[ptr + i] ?? 0) ^ XOR_KEY
      if (b === 0) return { text: latin1(new Uint8Array(bytes)), next: ptr + i + 1 }
      bytes.push(b)
    }
    return { text: latin1(new Uint8Array(bytes)), next: ptr + 1024 }
  }

  private parseTables(): PrgTable[] {
    const tableOffset = this.headerInt32(0x84)
    const tableCount = new DataView(this.decBytes(tableOffset, 4).buffer).getUint32(0, true)
    let offset = tableOffset + 4

    const tables: PrgTable[] = []
    for (let t = 0; t < tableCount; t++) {
      const entry = this.decBytes(offset, 0x50)
      offset += 0x50
      const ev = new DataView(entry.buffer)
      const name = readNullString(entry.subarray(0, 0x40))
      const colOffset = ev.getUint32(0x40, true)
      const colCount = ev.getUint32(0x48, true)
      const rowCount = ev.getUint32(0x4c, true)

      let ptr = colOffset
      const columns: string[] = []
      for (let c = 0; c < colCount; c++) {
        const col = this.readCString(ptr)
        columns.push(col.text)
        ptr = col.next
      }

      const rows: string[][] = []
      for (let r = 0; r < rowCount; r++) {
        const values: string[] = []
        for (let c = 0; c < colCount; c++) {
          const cell = this.readCString(ptr)
          values.push(cell.text)
          ptr = cell.next
        }
        rows.push(values)
      }

      tables.push({ name, columns, rows })
    }
    return tables
  }

  private parseJobs(comments: Map<string, string[]>): PrgJob[] {
    const jobListOffset = this.headerInt32(0x88)
    const numJobs = this.int32Raw(jobListOffset)
    let offset = jobListOffset + 4

    const jobs: PrgJob[] = []
    for (let i = 0; i < numJobs; i++) {
      const entry = this.decBytes(offset, 0x44)
      offset += 0x44
      const name = readNullString(entry.subarray(0, 0x40))
      const address = new DataView(entry.buffer).getInt32(0x40, true)
      let disassembly: string[]
      try {
        disassembly = this.disassembleJob(address)
      } catch (e) {
        disassembly = [`; DISASSEMBLY ERROR: ${e instanceof Error ? e.message : String(e)}`]
      }
      jobs.push({ name, address, comments: comments.get(name) ?? [], disassembly })
    }
    return jobs
  }

  // --- BEST/1 disassembler ---

  private readOpArg(offset: number, mode: number): OpArg {
    if (mode === 0) return { text: '', next: offset }

    if (mode >= 1 && mode <= 4) {
      const b = (this.raw[offset] ?? 0) ^ XOR_KEY
      const name = OA_NAMES[b] ?? `?${hex2(b)}`
      return { text: name, next: offset + 1 }
    }

    if (mode === 5) {
      const b = (this.raw[offset] ?? 0) ^ XOR_KEY
      if (b === 9) return { text: "#'\\t'", next: offset + 1 }
      if (b === 10) return { text: "#'\\n'", next: offset + 1 }
      if (b === 13) return { text: "#'\\r'", next: offset + 1 }
      if (b >= 32 && b < 127) return { text: `#'${String.fromCharCode(b)}'`, next: offset + 1 }
      return { text: `#$${pyHex(b, 2)}.B`, next: offset + 1 }
    }

    if (mode === 6) {
      const dv = new DataView(this.decBytes(offset, 2).buffer)
      return { text: `#$${pyHex(dv.getInt16(0, true), 4)}.I`, next: offset + 2 }
    }

    if (mode === 7) {
      const dv = new DataView(this.decBytes(offset, 4).buffer)
      const val = dv.getInt32(0, true)
      return { text: `#$${pyHex(val, 8)}.L`, next: offset + 4, raw32: val }
    }

    if (mode === 8) {
      const lenDv = new DataView(this.decBytes(offset, 2).buffer)
      const slen = lenDv.getInt16(0, true)
      offset += 2
      if (slen > 0) {
        const s = this.decBytes(offset, slen)
        offset += slen
        let printable = true
        for (let i = 0; i < s.length - 1; i++) {
          const b = s[i]
          if (!(b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127))) {
            printable = false
            break
          }
        }
        if (printable && s[s.length - 1] === 0) {
          return { text: `"${latin1(s.subarray(0, -1))}"`, next: offset }
        }
        return {
          text: `{${Array.from(s, (b) => `$${hex2(b)}.B`).join(',')}}`,
          next: offset,
        }
      }
      return { text: '""', next: offset }
    }

    if (mode === 9) {
      const d = this.decBytes(offset, 3)
      const reg = OA_NAMES[d[0]] ?? `?${hex2(d[0])}`
      const idx = new DataView(d.buffer).getInt16(1, true)
      return { text: `${reg}[#$${pyHex(idx, 4)}]`, next: offset + 3 }
    }

    if (mode === 10) {
      const d = this.decBytes(offset, 2)
      const r0 = OA_NAMES[d[0]] ?? `?${hex2(d[0])}`
      const r1 = OA_NAMES[d[1]] ?? `?${hex2(d[1])}`
      return { text: `${r0}[${r1}]`, next: offset + 2 }
    }

    if (mode === 11) {
      const d = this.decBytes(offset, 4)
      const r0 = OA_NAMES[d[0]] ?? `?${hex2(d[0])}`
      const r1 = OA_NAMES[d[1]] ?? `?${hex2(d[1])}`
      const inc = new DataView(d.buffer).getInt16(2, true)
      return { text: `${r0}[${r1},#$${pyHex(inc, 4)}]`, next: offset + 4 }
    }

    if (mode === 12) {
      const d = this.decBytes(offset, 5)
      const reg = OA_NAMES[d[0]] ?? `?${hex2(d[0])}`
      const dv = new DataView(d.buffer)
      const idx = dv.getInt16(1, true)
      const length = dv.getInt16(3, true)
      return { text: `${reg}[#$${pyHex(idx, 4)}]#$${pyHex(length, 4)}`, next: offset + 5 }
    }

    if (mode === 13) {
      const d = this.decBytes(offset, 4)
      const reg = OA_NAMES[d[0]] ?? `?${hex2(d[0])}`
      const idx = new DataView(d.buffer).getInt16(1, true)
      const regLen = OA_NAMES[d[3]] ?? `?${hex2(d[3])}`
      return { text: `${reg}[#$${pyHex(idx, 4)}]${regLen}`, next: offset + 4 }
    }

    if (mode === 14) {
      const d = this.decBytes(offset, 4)
      const reg = OA_NAMES[d[0]] ?? `?${hex2(d[0])}`
      const regIdx = OA_NAMES[d[1]] ?? `?${hex2(d[1])}`
      const length = new DataView(d.buffer).getInt16(2, true)
      return { text: `${reg}[${regIdx}]#$${pyHex(length, 4)}`, next: offset + 4 }
    }

    if (mode === 15) {
      const d = this.decBytes(offset, 3)
      const reg = OA_NAMES[d[0]] ?? `?${hex2(d[0])}`
      const regIdx = OA_NAMES[d[1]] ?? `?${hex2(d[1])}`
      const regLen = OA_NAMES[d[2]] ?? `?${hex2(d[2])}`
      return { text: `${reg}[${regIdx}]${regLen}`, next: offset + 3 }
    }

    throw new Error(`Unknown addressing mode: ${mode}`)
  }

  private disassembleJob(jobAddress: number): string[] {
    let offset = jobAddress
    let foundFirstEoj = false
    const lines = new Map<number, string>()
    const labels = new Set<number>()

    for (;;) {
      const address = offset
      const header = this.decBytes(offset, 2)
      offset += 2

      const opCode = header[0]
      const modeBits = header[1]
      const mode0 = (modeBits & 0xf0) >> 4
      const mode1 = modeBits & 0x0f

      const entry = OP_CODES[opCode]
      if (!entry) {
        throw new Error(`Unknown opcode 0x${hex2(opCode)} @ 0x${addr8(address)}`)
      }
      const [mnemonic, arg0IsNear] = entry

      const arg0 = this.readOpArg(offset, mode0)
      offset = arg0.next
      const arg1 = this.readOpArg(offset, mode1)
      offset = arg1.next

      if (arg0IsNear && mode0 === 7 && arg0.raw32 !== undefined) {
        const labelAddress = offset + arg0.raw32
        labels.add(labelAddress)
        arg0.text = `__${addr8(labelAddress)}`
      }

      let line = mnemonic
      if (arg0.text) {
        line = arg1.text
          ? `${mnemonic.padEnd(10)} ${arg0.text},${arg1.text}`
          : `${mnemonic.padEnd(10)} ${arg0.text}`
      }
      lines.set(address, line)

      if (opCode === 0x1d) {
        if (foundFirstEoj) break
        foundFirstEoj = true
      } else {
        foundFirstEoj = false
      }
    }

    const result: string[] = []
    for (const addr of [...lines.keys()].sort((a, b) => a - b)) {
      const line = lines.get(addr) ?? ''
      result.push(labels.has(addr) ? `__${addr8(addr)}: ${line}` : `                    ${line}`)
    }
    return result
  }

  parse(): PrgFile {
    if (this.raw.length < HEADER_SIZE) {
      throw new Error('File too small to be an EDIABAS .prg')
    }
    const info = this.parseInfo()
    const comments = this.parseDescription()
    const uses = this.parseUses()
    const ssize = this.parseSsize()
    const tables = this.parseTables()
    const jobs = this.parseJobs(comments)
    return { info, uses, ssize, tables, jobs }
  }
}

export function parsePrg(data: Uint8Array): PrgFile {
  return new PrgParser(data).parse()
}
