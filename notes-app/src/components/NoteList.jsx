import { useState } from 'react'

export default function NoteList({ notes, activeId, onSelect, onDelete, onDuplicate }) {
  const [contextMenu, setContextMenu] = useState(null)

  function handleContextMenu(e, note) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, noteId: note.id })
  }

  function closeContextMenu() {
    setContextMenu(null)
  }

  function formatDate(ts) {
    const d = new Date(ts)
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
    return d.toLocaleDateString()
  }

  function getPreview(content, maxLen = 80) {
    const text = content.replace(/[#*_`~\[\]]/g, '').trim()
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text || 'Empty note'
  }

  return (
    <div className="note-list" onClick={closeContextMenu}>
      {notes.length === 0 ? (
        <div className="note-list-empty">
          {notes.length === 0 ? 'No notes found' : 'No notes match your search'}
        </div>
      ) : (
        notes.map(note => (
          <div
            key={note.id}
            className={`note-item ${note.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(note.id)}
            onContextMenu={(e) => handleContextMenu(e, note)}
          >
            <div className="note-item-title">{note.title || 'Untitled'}</div>
            <div className="note-item-preview">{getPreview(note.content)}</div>
            <div className="note-item-footer">
              <span className="note-item-date">{formatDate(note.updatedAt)}</span>
              {note.tags && note.tags.length > 0 && (
                <div className="note-item-tags">
                  {note.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="tag-badge">{tag}</span>
                  ))}
                  {note.tags.length > 3 && <span className="tag-badge">+{note.tags.length - 3}</span>}
                </div>
              )}
            </div>
          </div>
        ))
      )}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => { onDuplicate(contextMenu.noteId); closeContextMenu() }}>Duplicate</button>
          <button className="danger" onClick={() => { onDelete(contextMenu.noteId); closeContextMenu() }}>Delete</button>
        </div>
      )}
    </div>
  )
}
