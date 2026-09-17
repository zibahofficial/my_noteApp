export default function TagFilter({ tags, selected, onSelect }) {
  return (
    <div className="tag-filter">
      <div className="tag-filter-label">Tags</div>
      <div className="tag-filter-list">
        <button
          className={`tag-filter-btn ${selected === null ? 'active' : ''}`}
          onClick={() => onSelect(null)}
        >
          All
        </button>
        {tags.map(tag => (
          <button
            key={tag}
            className={`tag-filter-btn ${selected === tag ? 'active' : ''}`}
            onClick={() => onSelect(selected === tag ? null : tag)}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  )
}
