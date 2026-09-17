import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'

export default function NoteEditor({ note, onUpdate, onDelete, onDuplicate, allTags }) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [tags, setTags] = useState(note.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [saveState, setSaveState] = useState(null)
  const textareaRef = useRef(null)
  const tagInputRef = useRef(null)

  useEffect(() => {
    if (title !== note.title) setTitle(note.title)
    if (content !== note.content) setContent(note.content)
    if (JSON.stringify(tags) !== JSON.stringify(note.tags || [])) setTags(note.tags || [])
  }, [note.id])

  useEffect(() => {
    const timer = setTimeout(() => {
      onUpdate({ title, content, tags })
    }, 300)
    return () => clearTimeout(timer)
  }, [title, content, tags])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        wrapSelection('**', '**')
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault()
        wrapSelection('*', '*')
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault()
        wrapSelection('`', '`')
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        wrapSelection('[', '](url)')
      }
    }
    const ta = textareaRef.current
    if (ta) {
      ta.addEventListener('keydown', handleKeyDown)
      return () => ta.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  function wrapSelection(before, after) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = content.slice(start, end)
    const newContent = content.slice(0, start) + before + selected + after + content.slice(end)
    setContent(newContent)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + before.length, end + before.length)
    }, 0)
  }

  function handleTab(e) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.target
      const start = ta.selectionStart
      const end = ta.selectionEnd
      setContent(content.slice(0, start) + '  ' + content.slice(end))
      setTimeout(() => {
        ta.setSelectionRange(start + 2, start + 2)
      }, 0)
    }
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag])
    }
    setTagInput('')
  }

  function removeTag(tag) {
    setTags(tags.filter(t => t !== tag))
  }

  function handleTagKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1))
    }
  }

  function handleSave() {
    setSaveState('saving')
    const promise = onUpdate({ title, content, tags })
    if (promise && typeof promise.then === 'function') {
      promise
        .then(() => {
          setSaveState('saved')
          setTimeout(() => setSaveState(null), 1500)
        })
        .catch(() => {
          setSaveState(null)
        })
    } else {
      setSaveState('saved')
      setTimeout(() => setSaveState(null), 1500)
    }
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0
  const charCount = content.length

  return (
    <div className="note-editor">
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <button
            className={`toolbar-btn ${!showPreview ? 'active' : ''}`}
            onClick={() => setShowPreview(false)}
            title="Edit"
          >
            ✏️ Edit
          </button>
          <button
            className={`toolbar-btn ${showPreview ? 'active' : ''}`}
            onClick={() => setShowPreview(true)}
            title="Preview"
          >
            👁 Preview
          </button>
          <span className="toolbar-separator">|</span>
          <button className="toolbar-btn" onClick={() => wrapSelection('**', '**')} title="Bold (Ctrl+B)">
            <b style={{ color: 'var(--accent)' }}>B</b>
          </button>
          <button className="toolbar-btn" onClick={() => wrapSelection('*', '*')} title="Italic (Ctrl+I)">
            <i>I</i>
          </button>
          <button className="toolbar-btn" onClick={() => wrapSelection('`', '`')} title="Code (Ctrl+E)">
            {'</>'}
          </button>
          <button className="toolbar-btn" onClick={() => wrapSelection('[', '](url)')} title="Link (Ctrl+K)">
            🔗
          </button>
          <button className="toolbar-btn" onClick={() => wrapSelection('\n- ', '')} title="List">
            ☰
          </button>
          <button className="toolbar-btn" onClick={() => wrapSelection('\n> ', '')} title="Quote">
            ❝
          </button>
          <button className="toolbar-btn" onClick={() => wrapSelection('\n```\n', '\n```\n')} title="Code block">
            { }</button>
        </div>
        <div className="toolbar-right">
          <button
            className={`toolbar-btn${saveState === 'saved' ? ' active' : ''}`}
            onClick={handleSave}
            disabled={saveState === 'saving'}
            title="Save note"
          >
            {saveState === 'saved' ? '✓ Saved' : saveState === 'saving' ? 'Saving…' : '💾 Save'}
          </button>
          <button className="toolbar-btn" onClick={onDuplicate} title="Duplicate note">📋</button>
          <button
            className="toolbar-btn danger"
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete note"
          >
            🗑
          </button>
        </div>
      </div>

      <input
        className="editor-title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title..."
        spellCheck="false"
      />

      <div className="editor-tags">
        {tags.map(tag => (
          <span key={tag} className="tag">
            {tag}
            <button className="tag-remove" onClick={() => removeTag(tag)}>×</button>
          </span>
        ))}
        <input
          ref={tagInputRef}
          className="tag-input"
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleTagKeyDown}
          onBlur={addTag}
          placeholder={tags.length === 0 ? "Add tags..." : ""}
          list="tag-suggestions"
        />
        <datalist id="tag-suggestions">
          {allTags.filter(t => !tags.includes(t)).map(tag => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      </div>

      <div className="editor-content">
        {showPreview ? (
          <div className="markdown-preview">
            {content ? (
              <ReactMarkdown>{content}</ReactMarkdown>
            ) : (
              <p className="empty-preview">Nothing to preview</p>
            )}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            className="editor-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleTab}
            placeholder="Start writing... (Markdown supported)"
            spellCheck="false"
          />
        )}
      </div>

      <div className="editor-footer">
        <span>{wordCount} words · {charCount} characters</span>
        <span>Last updated: {new Date(note.updatedAt).toLocaleString()}</span>
      </div>

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete note?</h3>
            <p>This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="btn-danger" onClick={() => { onDelete(); setShowDeleteConfirm(false) }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
