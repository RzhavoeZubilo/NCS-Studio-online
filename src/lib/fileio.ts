/** Reads a file as UTF-8, falling back to Windows-1252 for legacy-encoded files. */
export async function readTextSmart(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const utf8 = new TextDecoder('utf-8').decode(buf)
  if (!utf8.includes('\uFFFD')) return utf8
  return new TextDecoder('windows-1252').decode(buf)
}

export function downloadText(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

interface WritableLike {
  write(data: string): Promise<void>
  close(): Promise<void>
}

interface SavePicker {
  showSaveFilePicker?: (opts?: {
    suggestedName?: string
    types?: { description?: string; accept: Record<string, string[]> }[]
  }) => Promise<{ createWritable(): Promise<WritableLike> }>
}

/** Saves via the File System Access API when available, otherwise downloads. */
export async function saveTextFile(fileName: string, content: string): Promise<void> {
  const picker = (window as unknown as SavePicker).showSaveFilePicker
  if (picker) {
    try {
      const handle = await picker.call(window, { suggestedName: fileName })
      const writable = await handle.createWritable()
      await writable.write(content)
      await writable.close()
      return
    } catch (e) {
      // User cancelled the dialog — not an error.
      if (e instanceof DOMException && e.name === 'AbortError') return
      downloadText(fileName, content)
      return
    }
  }
  downloadText(fileName, content)
}
