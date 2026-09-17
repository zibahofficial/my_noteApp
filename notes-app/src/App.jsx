import { useState, useEffect, useMemo, useCallback } from 'react'
import NoteList from './components/NoteList'
import NoteEditor from './components/NoteEditor'
import SearchBar from './components/SearchBar'
import TagFilter from './components/TagFilter'
import { fetchNotes, createNote, updateNote, deleteNote, duplicateNote, fetchTags, login, register, setToken, getToken, fetchMe } from './utils/api'
import './App.css'

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const data = mode === 'login'
        ? await login(username, password)
        : await register(username, password)
      onAuth(data.user)
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">🌸</div>
        <h1 className="auth-title">My Notes</h1>
        <p className="auth-subtitle">
          {mode === 'login'
            ? 'Welcome back! Log in to your private notebook.'
            : 'Create your private notebook.'}
        </p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          <input
            className="auth-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            spellCheck="false"
          />
          <input
            className="auth-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          <button className="auth-submit" type="submit" disabled={submitting || !username || !password}>
            {submitting ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>
        <button className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null) }}>
          {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Log in'}
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [notes, setNotes] = useState([])
  const [activeNoteId, setActiveNoteId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState(null)
  const [allTags, setAllTags] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (getToken()) {
      fetchMe()
        .then(setUser)
        .catch(() => setToken(null))
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const tag = selectedTag || undefined
      const [notesData, tagsData] = await Promise.all([
        fetchNotes(searchQuery.trim() || undefined, tag),
        fetchTags(),
      ])
      setNotes(notesData)
      setAllTags(tagsData)
    } catch (err) {
      console.error('Failed to load notes:', err)
      setError('Could not reach the server. Make sure the backend is running on http://localhost:8000.')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedTag])

  useEffect(() => {
    if (user) {
      loadData()
    } else {
      setNotes([])
      setAllTags([])
      setActiveNoteId(null)
    }
  }, [user, loadData])

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null)
    }
    window.addEventListener('notes-auth-expired', handleAuthExpired)
    return () => window.removeEventListener('notes-auth-expired', handleAuthExpired)
  }, [])

  function handleAuth(userData) {
    setUser(userData)
  }

  function handleLogout() {
    setToken(null)
    setUser(null)
    setSearchQuery('')
    setSelectedTag(null)
    setNotes([])
    setAllTags([])
    setActiveNoteId(null)
  }

  const filteredNotes = useMemo(() => notes, [notes])

  const activeNote = notes.find(n => n.id === activeNoteId) || null

  async function handleCreate() {
    try {
      const newNote = await createNote({ title: 'Untitled Note', content: '', tags: [] })
      setError(null)
      setNotes(prev => [newNote, ...prev])
      setActiveNoteId(newNote.id)
      setSelectedTag(null)
      setSearchQuery('')
    } catch (err) {
      console.error('Failed to create note:', err)
      setError('Failed to create note. Check your connection and try again.')
    }
  }

  async function handleUpdate(id, updates) {
    setNotes(prev => prev.map(note => note.id === id ? { ...note, ...updates } : note))
    try {
      await updateNote(id, updates)
      setError(null)
      const newTags = await fetchTags()
      setAllTags(newTags)
    } catch (err) {
      console.error('Failed to update note:', err)
      setError('Failed to save changes. Check your connection and try again.')
    }
  }

  async function handleDelete(id) {
    try {
      await deleteNote(id)
      setError(null)
      setNotes(prev => prev.filter(note => note.id !== id))
      if (activeNoteId === id) setActiveNoteId(null)
    } catch (err) {
      console.error('Failed to delete note:', err)
      setError('Failed to delete note. Check your connection and try again.')
    }
  }

  async function handleDuplicate(id) {
    try {
      const newNote = await duplicateNote(id)
      setError(null)
      setNotes(prev => [newNote, ...prev])
      setActiveNoteId(newNote.id)
    } catch (err) {
      console.error('Failed to duplicate note:', err)
      setError('Failed to duplicate note. Check your connection and try again.')
    }
  }

  if (!user) {
    return (
      <div className="app">
        <span className="floral-corner floral-tl">🌷</span>
        <span className="floral-corner floral-tr">🌸</span>
        <span className="floral-corner floral-bl">💐</span>
        <span className="floral-corner floral-br">🌺</span>
        <span className="floral-corner floral-mid-tl">🪷</span>
        <span className="floral-corner floral-mid-bl">🌹</span>
        <AuthScreen onAuth={handleAuth} />
      </div>
    )
  }

  return (
    <div className="app">
      <span className="floral-corner floral-tl">🌷</span>
      <span className="floral-corner floral-tr">🌸</span>
      <span className="floral-corner floral-bl">💐</span>
      <span className="floral-corner floral-br">🌺</span>
      <span className="floral-corner floral-mid-tl">🪷</span>
      <span className="floral-corner floral-mid-bl">🌹</span>
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => loadData()}>Retry</button>
          <button className="error-dismiss" onClick={() => setError(null)}>✕</button>
        </div>
      )}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h1>🌸 My Notes</h1>
          <button className="btn-icon" onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle sidebar">
            ☰
          </button>
        </div>
        {user.username && (
          <div className="user-bar">
            <span className="user-bar-name">👤 {user.username}</span>
            <button className="btn-icon user-logout" onClick={handleLogout} title="Log out">⏻</button>
          </div>
        )}
        <button className="btn-new-note" onClick={handleCreate}>+ New Note</button>
        <SearchBar query={searchQuery} onChange={setSearchQuery} />
        {allTags.length > 0 && (
          <TagFilter
            tags={allTags}
            selected={selectedTag}
            onSelect={setSelectedTag}
          />
        )}
        {loading ? (
          <div className="note-list-empty">Loading...</div>
        ) : (
          <NoteList
            notes={filteredNotes}
            activeId={activeNoteId}
            onSelect={setActiveNoteId}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
          />
        )}
      </aside>
      {!sidebarOpen && (
        <button className="btn-icon sidebar-reopen" onClick={() => setSidebarOpen(true)} title="Open sidebar">
          ☰
        </button>
      )}
      <main className="editor-area">
        {activeNote ? (
          <NoteEditor
            key={activeNote.id}
            note={activeNote}
            onUpdate={(updates) => handleUpdate(activeNote.id, updates)}
            onDelete={() => handleDelete(activeNote.id)}
            onDuplicate={() => handleDuplicate(activeNote.id)}
            allTags={allTags}
          />
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🌷</div>
            <h2>No note selected</h2>
            <p>Select a note from the sidebar or create a new one.</p>
            <button className="btn-primary" onClick={handleCreate}>+ New Note</button>
          </div>
        )}
      </main>
    </div>
  )
}