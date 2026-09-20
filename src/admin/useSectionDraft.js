import { useState } from 'react'
import { useContent } from '../context/ContentContext'

export function useSectionDraft(sectionKey) {
  const { content, updateSection } = useContent()
  const [draft, setDraft] = useState(content[sectionKey])
  const [saved, setSaved] = useState(false)

  const save = () => {
    updateSection(sectionKey, draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return { draft, setDraft, save, saved }
}
