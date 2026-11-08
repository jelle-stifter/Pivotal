/** Trigger a browser download of text content. */
export function downloadText(
  fileName: string,
  text: string,
  mime = 'text/csv;charset=utf-8',
) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
