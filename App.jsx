
import { useEffect, useState } from 'react'
import './App.css'

const API = 'http://localhost:8080/api'

const emptyForm = {
  name: '',
  category: 'Study Material',
  weight: '',
  description: '',
  subjectId: '',
}

const cardStyle = {
  background: '#ffffff',
  border: '1px solid #e9e5f5',
  borderRadius: '16px',
  padding: '22px',
  minWidth: 0,
}

const sectionTitleStyle = {
  margin: '0 0 6px',
  color: '#24213b',
  fontSize: '20px',
}

const mutedStyle = {
  color: '#85839c',
  fontSize: '14px',
  margin: '0 0 18px',
}

function subjectName(entry) {
  if (typeof entry?.subject === 'string') return entry.subject
  return entry?.subject?.name ||
    entry?.subjectName ||
    entry?.name ||
    'Class'
}

function classTime(entry) {
  const start =
    entry?.startTime || entry?.start_time || entry?.start || ''
  const end =
    entry?.endTime || entry?.end_time || entry?.end || ''

  if (start && end) return `${start} – ${end}`
  return start || end || 'Time not specified'
}

function App() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ ...emptyForm })
  const [editingId, setEditingId] = useState(null)

  // Subjects, timetable and smart recommendation
  const [subjects, setSubjects] = useState([])
  const [timetable, setTimetable] = useState([])
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [recommendation, setRecommendation] = useState(null)
  const [studyError, setStudyError] = useState('')
  const [studyLoading, setStudyLoading] = useState(false)
  const [studyRefreshing, setStudyRefreshing] = useState(false)

  async function loadItems() {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API}/bag-items`)

      if (!response.ok) {
        throw new Error(`Could not load items (HTTP ${response.status}).`)
      }

      const data = await response.json()
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Cannot connect to Spring Boot.')
    } finally {
      setLoading(false)
    }
  }

  async function loadStudyData() {
    setStudyRefreshing(true)
    setStudyError('')

    try {
      const [subjectsResponse, timetableResponse] = await Promise.all([
        fetch(`${API}/subjects`),
        fetch(`${API}/timetable`),
      ])

      if (!subjectsResponse.ok) {
        throw new Error(
          `Could not load subjects (HTTP ${subjectsResponse.status}).`
        )
      }

      if (!timetableResponse.ok) {
        throw new Error(
          `Could not load timetable (HTTP ${timetableResponse.status}).`
        )
      }

      const subjectsData = await subjectsResponse.json()
      const timetableData = await timetableResponse.json()
      const subjectList = Array.isArray(subjectsData) ? subjectsData : []

      setSubjects(subjectList)
      setTimetable(Array.isArray(timetableData) ? timetableData : [])

      setSelectedSubjectId(current => {
        if (
          current &&
          subjectList.some(subject => String(subject.id) === current)
        ) {
          return current
        }

        return subjectList.length ? String(subjectList[0].id) : ''
      })
    } catch (err) {
      setStudyError(err.message || 'Could not load study information.')
    } finally {
      setStudyRefreshing(false)
    }
  }

  async function loadRecommendation(subjectId) {
    if (!subjectId) {
      setRecommendation(null)
      return
    }

    setStudyLoading(true)
    setStudyError('')
    setRecommendation(null)

    try {
      const response = await fetch(`${API}/daily-bag/${subjectId}`)

      if (!response.ok) {
        throw new Error(
          `Could not load recommendation (HTTP ${response.status}).`
        )
      }

      setRecommendation(await response.json())
    } catch (err) {
      setStudyError(err.message || 'Could not load the recommendation.')
    } finally {
      setStudyLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
    loadStudyData()
  }, [])

  useEffect(() => {
    if (selectedSubjectId) {
      loadRecommendation(selectedSubjectId)
    } else {
      setRecommendation(null)
    }
  }, [selectedSubjectId])

  function handleChange(event) {
    const { name, value } = event.target
    setForm(previous => ({ ...previous, [name]: value }))
  }

  function editItem(item) {
    setEditingId(item.id)
    setForm({
      name: item.name ?? '',
      category: item.category || 'Other',
      weight: String(item.weight ?? ''),
      description: item.description ?? '',
    })
    setError('')

    requestAnimationFrame(() => {
      document.getElementById('bag-item-form')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })

      document.querySelector('.item-form input[name="name"]')?.focus({
        preventScroll: true,
      })
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({ ...emptyForm })
    setError('')
  }

  async function saveItem(event) {
    event.preventDefault()
    setError('')

    const payload = {
    name: form.name.trim(),
    category: form.category,
    weight: Number(form.weight),
    description: form.description.trim(),
    subject: form.subjectId
        ? { id: Number(form.subjectId) }
        : null,
}

    if (!payload.name) {
      setError('Please enter an item name.')
      return
    }

    if (
      form.weight.trim() === '' ||
      !Number.isFinite(payload.weight) ||
      payload.weight < 0
    ) {
      setError('Please enter a valid weight of zero or more.')
      return
    }

    const isEditing = editingId !== null
    const url = isEditing
      ? `${API}/bag-items/${editingId}`
      : `${API}/bag-items`

    try {
      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(
          message || `Could not ${isEditing ? 'update' : 'add'} item.`
        )
      }

      setForm({ ...emptyForm })
      setEditingId(null)
      await loadItems()
    } catch (err) {
      setError(err.message || 'Could not save the item.')
    }
  }

  async function deleteItem(id) {
    if (!window.confirm('Are you sure you want to delete this item?')) {
      return
    }

    setError('')

    try {
      const response = await fetch(`${API}/bag-items/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`Could not delete item (HTTP ${response.status}).`)
      }

      if (editingId === id) cancelEdit()
      await loadItems()
    } catch (err) {
      setError(err.message || 'Could not delete the item.')
    }
  }

  const totalWeight = items.reduce(
    (total, item) => total + Number(item.weight || 0),
    0
  )

  const totalCategories = new Set(
    items.map(item => item.category).filter(Boolean)
  ).size

  
  const recommendedItemsRaw = Array.isArray(recommendation)
    ? recommendation
    : Array.isArray(recommendation?.requiredItems)
    ? recommendation.requiredItems
    : Array.isArray(recommendation?.items)
    ? recommendation.items
    : Array.isArray(recommendation?.requiredItemsList)
    ? recommendation.requiredItemsList
    : Array.isArray(recommendation?.recommendedItems)
    ? recommendation.recommendedItems
    : Array.isArray(recommendation?.data)
    ? recommendation.data
    : [];

  const getItemName = (item) =>
    String(
      typeof item === 'string'
        ? item
        : item?.name || item?.itemName || ''
    ).trim().toLowerCase();

  const recommendedItems = recommendedItemsRaw.filter(
    (item, index, list) =>
      list.findIndex(
        (other) => getItemName(other) === getItemName(item)
      ) === index
  );


  const selectedSubject = subjects.find(
    subject => String(subject.id) === selectedSubjectId
  )

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">🎒</div>
          <div>
            <h2>SmartBag</h2>
            <span>MANAGEMENT SYSTEM</span>
          </div>
        </div>

        <p className="nav-heading">WORKSPACE</p>
        <div className="nav-item active">▦ &nbsp; Dashboard</div>
        <div
  className="nav-item"
  onClick={() => {
    document.getElementById('bag-item-form')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }}
  style={{ cursor: 'pointer' }}
>
  🎒 &nbsp; My Bag Items
</div>
                           <div
            className="nav-item"
            onClick={() => {
              document
                .getElementById('study-materials')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            style={{ cursor: 'pointer' }}
          >
            📚 &nbsp; Study Materials
          </div>

        <div className="sidebar-bottom">
          <div className="avatar">S</div>
          <div>
            <strong>Student Workspace</strong>
            <span>Personal bag manager</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace / Dashboard</span>
            <h1>Smart Bag Dashboard</h1>
          </div>
          <div className="status">
            <span />
            Bag Manager
          </div>
        </header>

        <section className="welcome">
          <div>
            <span className="eyebrow">YOUR DAY, ORGANIZED</span>
            <h2>Pack smarter. Study better.</h2>
            <p>Keep your study essentials organized and ready for the day.</p>
          </div>
          <div className="bag-illustration">🎒</div>
        </section>

        {error && <div className="error" role="alert">{error}</div>}

        <section className="stats">
          <div className="stat-card">
            <div className="stat-icon purple">🎒</div>
            <span>Total bag items</span>
            <h2>{items.length}</h2>
            <p>Items in your collection</p>
          </div>

          <div className="stat-card">
            <div className="stat-icon green">⚖️</div>
            <span>Total bag weight</span>
            <h2>{totalWeight.toFixed(2)} <small>kg</small></h2>
            <p>Combined item weight</p>
          </div>

          <div className="stat-card">
            <div className="stat-icon orange">📚</div>
            <span>Categories</span>
            <h2>{totalCategories}</h2>
            <p>Different item categories</p>
          </div>
        </section>

        {/* New feature: Subjects and timetable */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
            marginBottom: '26px',
          }}
        >
          <div id="study-materials" style={cardStyle}>
  <h2 style={sectionTitleStyle}>📚 My Subjects</h2>
            <p style={mutedStyle}>Choose a subject for your bag recommendation.</p>

            {subjects.length > 0 ? (
              <>
                <label
                  htmlFor="subject-select"
                  style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}
                >
                  Select subject
                </label>

                <select
                  id="subject-select"
                  value={selectedSubjectId}
                  onChange={event => setSelectedSubjectId(event.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e1dced',
                    borderRadius: '10px',
                    background: '#fff',
                    color: '#292441',
                  }}
                >
                  {subjects.map(subject => (
                    <option key={subject.id} value={String(subject.id)}>
                      {subject.name || subject.subjectName || `Subject ${subject.id}`}
                      {subject.code ? ` (${subject.code})` : ''}
                    </option>
                  ))}
                </select>

                <div style={{ marginTop: '16px', display: 'grid', gap: '10px' }}>
                  {subjects.map(subject => (
                    <button
                      type="button"
                      key={subject.id}
                      onClick={() => setSelectedSubjectId(String(subject.id))}
                      style={{
                        textAlign: 'left',
                        padding: '12px',
                        borderRadius: '10px',
                        border: String(subject.id) === selectedSubjectId
                          ? '1px solid #7454e8'
                          : '1px solid #eeeaf5',
                        background: String(subject.id) === selectedSubjectId
                          ? '#f3efff'
                          : '#fff',
                        cursor: 'pointer',
                        color: '#292441',
                      }}
                    >
                      <strong>
                        📘 {subject.name || subject.subjectName || `Subject ${subject.id}`}
                      </strong>
                      {subject.code && (
                        <span style={{ display: 'block', marginTop: '4px', color: '#85839c' }}>
                          Code: {subject.code}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ color: '#85839c' }}>
                No subjects found. Check that the backend is running and has subjects.
              </p>
            )}
          </div>

          <div style={cardStyle}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'start',
                gap: '12px',
              }}
            >
              <div>
                <h2 style={sectionTitleStyle}>🗓️ Timetable</h2>
                <p style={mutedStyle}>Your scheduled classes.</p>
              </div>

              <button
                className="refresh-button"
                type="button"
                disabled={studyRefreshing}
                onClick={loadStudyData}
              >
                {studyRefreshing ? 'Loading...' : '↻ Refresh'}
              </button>
            </div>

            {timetable.length > 0 ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                {timetable.map((entry, index) => (
                  <div
                    key={entry.id ?? `${subjectName(entry)}-${index}`}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                      padding: '13px',
                      borderRadius: '10px',
                      background: '#f8f6ff',
                    }}
                  >
                    <span style={{ fontSize: '24px' }}>🕘</span>
                    <div>
                      <strong style={{ display: 'block', color: '#292441' }}>
                        {subjectName(entry)}
                      </strong>
                      <span style={{ display: 'block', marginTop: '5px', color: '#7454e8' }}>
                        {classTime(entry)}
                      </span>
                      {entry.room && (
                        <small style={{ color: '#85839c' }}>Room: {entry.room}</small>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#85839c' }}>
                No timetable entries found.
              </p>
            )}
          </div>
        </section>

        {/* New feature: Smart recommendation */}
        
      {/* Smart Bag Recommendation */}
      <section
        style={{
          background: '#ffffff',
          borderRadius: '18px',
          padding: '24px',
          marginBottom: '26px',
          border: '1px solid #eeeaf5',
        }}
      >
        <h2 style={{ color: '#292441', marginBottom: '8px' }}>
          🎯 Smart Bag Recommendation
        </h2>

        <p style={{ color: '#85839c', marginBottom: '18px' }}>
          Items to carry for the selected subject.
        </p>
        <div
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '20px',
  }}
>
  <div
    style={{
      flex: '1',
      minWidth: '140px',
      padding: '16px',
      borderRadius: '12px',
      background: '#f3efff',
      textAlign: 'center',
    }}
  >
    <p style={{ color: '#85839c', margin: 0 }}>Recommended items</p>
    <h2 style={{ color: '#7048e8', margin: '8px 0 0' }}>
      {recommendedItems.length}
    </h2>
  </div>

  <div
    style={{
      flex: '1',
      minWidth: '140px',
      padding: '16px',
      borderRadius: '12px',
      background: '#eafaf0',
      textAlign: 'center',
    }}
  >
    <p style={{ color: '#85839c', margin: 0 }}>Selected subject</p>
    <h3 style={{ color: '#16834a', margin: '8px 0 0' }}>
      {subjects.find(
        (subject) => String(subject.id) === String(selectedSubjectId)
      )?.name || 'Not selected'}
    </h3>
  </div>
</div>


        {studyError && (
          <p style={{ color: '#dc2626' }}>{studyError}</p>
        )}

        {studyLoading ? (
          <p style={{ color: '#85839c' }}>Loading recommendations...</p>
        ) : recommendedItems.length > 0 ? (
          <div style={{ display: 'grid', gap: '10px' }}>
            {recommendedItems.map((item, index) => {
              const name =
                typeof item === 'string'
                  ? item
                  : item?.name ||
                    item?.itemName ||
                    `Required item ${index + 1}`;

              return (
                <div
                  key={item?.id ?? `${name}-${index}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '13px',
                    border: '1px solid #eeeaf5',
                    borderRadius: '10px',
                  }}
                >
                  <span
                    style={{
                      background: '#e8f8ed',
                      color: '#22864a',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>

                  <div style={{ flex: 1 }}>
                    <strong style={{ color: '#292441' }}>{name}</strong>
                    {item?.category && (
                      <small
                        style={{ display: 'block', color: '#85839c' }}
                      >
                        {item.category}
                      </small>
                    )}
                  </div>

                  {item?.weight != null && (
                    <span style={{ color: '#7454e8', fontWeight: 600 }}>
                      {Number(item.weight).toFixed(2)} kg
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: '#85839c' }}>
            {selectedSubjectId
              ? 'No recommendation items are available for this subject yet.'
              : 'Select a subject to see recommendations.'}
          </p>
        )}
      </section>

        {/* Existing bag item form */}
        <section className="content-grid">
          <div className="panel" id="bag-item-form">
            <div className="panel-heading">
              <div>
                <h2>{editingId !== null ? 'Edit bag item' : 'Add a bag item'}</h2>
                <p>
                  {editingId !== null
                    ? `Editing item ID ${editingId}. Change the details and save.`
                    : 'Enter the details of an item you need.'}
                </p>
              </div>
              <span className="heading-icon">{editingId !== null ? '✎' : '＋'}</span>
            </div>

            <form onSubmit={saveItem} className="item-form">
              <label>
                Item name
                <input
                  required
                  name="name"
                  placeholder="e.g. Digital Electronics Notebook"
                  value={form.name}
                  onChange={handleChange}
                />
              </label>

              <label>
                Category
                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                >
                  <option>Study Material</option>
                  <option>Electronics</option>
                  <option>Stationery</option>
                  <option>Personal Items</option>
                  <option>Other</option>
                </select>
              </label>
                <label>
  Subject
  <select
    name="subjectId"
    value={form.subjectId || ''}
    onChange={handleChange}
  >
    <option value="">Select a subject</option>
    {subjects.map((subject) => (
      <option key={subject.id} value={subject.id}>
        {subject.name} ({subject.code})
      </option>
    ))}
  </select>
</label>
              <label>
                Weight (kg)
                <input
                  required
                  name="weight"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 0.30"
                  value={form.weight}
                  onChange={handleChange}
                />
              </label>

              <label>
                Description
                <textarea
                  name="description"
                  placeholder="Optional item details..."
                  rows="3"
                  value={form.description}
                  onChange={handleChange}
                />
              </label>

              <button className="primary-button" type="submit">
                {editingId !== null ? 'Save Changes' : '+ Add to My Bag'}
              </button>

              {editingId !== null && (
                <button
                  className="refresh-button"
                  type="button"
                  onClick={cancelEdit}
                >
                  Cancel Edit
                </button>
              )}
            </form>
          </div>

          {/* Existing bag item list */}
          <div className="panel items-panel">
            <div className="panel-heading">
              <div>
                <h2>My bag items</h2>
                <p>Your saved items, all in one place.</p>
              </div>
              <button
                className="refresh-button"
                onClick={loadItems}
                type="button"
                disabled={loading}
              >
                {loading ? 'Loading...' : '↻ Refresh'}
              </button>
            </div>

            {loading ? (
              <p className="empty-state">Loading your bag items...</p>
            ) : items.length === 0 ? (
              <div className="empty-state">
                <div>🎒</div>
                <strong>Your bag is ready!</strong>
                <p>Add your first item using the form.</p>
              </div>
            ) : (
              <div className="items-list">
                {items.map(item => (
                  <div className="item-row" key={item.id}>
                    <div className="item-icon">📘</div>

                    <div className="item-details">
                      <strong>{item.name}</strong>
                      <span>{item.category || 'Uncategorized'}</span>
                      {item.description && <p>{item.description}</p>}
                    </div>

                    <div className="item-weight">
                      {Number(item.weight || 0).toFixed(2)} kg
                    </div>

                    <button
                      className="refresh-button"
                      type="button"
                      title={`Edit ${item.name}`}
                      onClick={() => editItem(item)}
                    >
                      Edit
                    </button>

                    <button
                      className="delete-button"
                      type="button"
                      title={`Delete ${item.name}`}
                      onClick={() => deleteItem(item.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <footer>SmartBag Management System · React + Spring Boot</footer>
      </main>
    </div>
  )
}

export default App
