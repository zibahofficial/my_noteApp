export default function SearchBar({ query, onChange }) {
  return (
    <div className="search-bar">
      <span className="search-icon">🔍</span>
      <input
        type="text"
        className="search-input"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search notes..."
      />
      {query && (
        <button className="search-clear" onClick={() => onChange('')}>×</button>
      )}
    </div>
  )
}
