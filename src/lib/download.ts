/** Hand a generated file to the browser. DOM-only, kept out of the data layer. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoke on the next tick, once the download has been handed off.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
