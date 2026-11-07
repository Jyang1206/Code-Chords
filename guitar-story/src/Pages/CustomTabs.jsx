import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CustomTabsService } from '../services/customTabsService';
import '../css/CustomTabs.css';

const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OPEN_STRINGS = ['E', 'A', 'D', 'G', 'B', 'E']; // 6th to 1st string

function getNoteAtPosition(stringIdx, fretNum) {
  const openNoteIdx = ALL_NOTES.indexOf(OPEN_STRINGS[stringIdx]);
  const noteIdx = (openNoteIdx + fretNum) % 12;
  return ALL_NOTES[noteIdx];
}

/* ---------- Presentation helpers ---------- */
const STAFF_ROWS = [6, 5, 4, 3, 2, 1]; // top line to bottom line, as tab is read
const FRETS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// the name printed at the left of each tab line
function stringLabel(stringNum) {
  const name = OPEN_STRINGS[stringNum - 1];
  return stringNum === 6 ? name.toLowerCase() : name;
}

function stringName(stringNum) {
  if (stringNum === 1) return 'Low E string';
  if (stringNum === 6) return 'High e string';
  return `${OPEN_STRINGS[stringNum - 1]} string`;
}

function CustomTabs() {
  const { currentUser } = useAuth();
  const [customTabs, setCustomTabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTab, setNewTab] = useState({
    title: '',
    artist: '',
    notes: []
  });
  const [currentNote, setCurrentNote] = useState({
    stringIdx: 1,
    fretNum: 0,
    duration: 1
  });

  // Load user's custom tabs
  useEffect(() => {
    if (currentUser) {
      loadCustomTabs();
    }
  }, [currentUser]);

  const loadCustomTabs = async () => {
    try {
      setLoading(true);
      const result = await CustomTabsService.getUserTabs(currentUser.uid);
      if (result.success) {
        setCustomTabs(result.data);
      } else {
        console.error('Failed to load custom tabs:', result.error);
      }
    } catch (error) {
      console.error('Error loading custom tabs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = () => {
    if (newTab.title.trim() === '') {
      alert('Please enter a title for your tab');
      return;
    }

    const noteWithNoteName = {
      ...currentNote,
      note: getNoteAtPosition(currentNote.stringIdx - 1, currentNote.fretNum)
    };

    setNewTab(prev => ({
      ...prev,
      notes: [...prev.notes, noteWithNoteName]
    }));

    // Reset current note
    setCurrentNote({
      stringIdx: 1,
      fretNum: 0,
      duration: 1
    });
  };

  const handleRemoveNote = (index) => {
    setNewTab(prev => ({
      ...prev,
      notes: prev.notes.filter((_, i) => i !== index)
    }));
  };

  const handleSaveTab = async () => {
    if (newTab.title.trim() === '') {
      alert('Please enter a title for your tab');
      return;
    }

    if (newTab.notes.length === 0) {
      alert('Please add at least one note to your tab');
      return;
    }

    try {
      const result = await CustomTabsService.addCustomTab(currentUser.uid, newTab);
      if (result.success) {
        alert('Custom tab saved successfully!');
        setNewTab({ title: '', artist: '', notes: [] });
        setShowCreateForm(false);
        loadCustomTabs(); // Reload the list
      } else {
        alert('Failed to save tab: ' + result.error);
      }
    } catch (error) {
      console.error('Error saving custom tab:', error);
      alert('Error saving tab');
    }
  };

  const handleDeleteTab = async (tabId) => {
    if (window.confirm('Are you sure you want to delete this tab?')) {
      try {
        const result = await CustomTabsService.deleteCustomTab(tabId);
        if (result.success) {
          loadCustomTabs(); // Reload the list
        } else {
          alert('Failed to delete tab: ' + result.error);
        }
      } catch (error) {
        console.error('Error deleting custom tab:', error);
        alert('Error deleting tab');
      }
    }
  };

  const GuitarTabInterface = () => (
    <div className="tab-picker">
      <div className="tab-section-head">
        <h3>Pick a note</h3>
        <p>Choose a string and fret, set how long it rings, then add it to the tab.</p>
      </div>

      <div className="tab-staff-scroll">
        <div className="tab-staff tab-staff--picker" role="group" aria-label="Fret picker">
          <div className="tab-staff-frets" aria-hidden="true">
            <span className="tab-staff-name" />
            {FRETS.map(fret => (
              <span key={fret} className="tab-staff-fretnum">{fret}</span>
            ))}
          </div>

          {STAFF_ROWS.map(stringNum => (
            <div key={stringNum} className="tab-line">
              <span className="tab-staff-name" aria-hidden="true">{stringLabel(stringNum)}</span>
              {FRETS.map(fret => {
                const noteName = getNoteAtPosition(stringNum - 1, fret);
                const isSelected = currentNote.stringIdx === stringNum && currentNote.fretNum === fret;

                return (
                  <button
                    type="button"
                    key={`${stringNum}-${fret}`}
                    className={`fret-cell${isSelected ? ' is-selected' : ''}`}
                    aria-pressed={isSelected}
                    aria-label={`${stringName(stringNum)}, fret ${fret}, ${noteName}`}
                    onClick={() => setCurrentNote({ stringIdx: stringNum, fretNum: fret, duration: 1 })}
                  >
                    <span className="fret-cell-num">{fret}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Current note + add */}
      <div className="tab-toolbar">
        <p className="tab-selected">
          <span className="tab-selected-label">Selected</span>
          <span>{stringName(currentNote.stringIdx)}, fret <span className="mono-amber">{currentNote.fretNum}</span></span>
          <span className="tab-selected-note mono-amber">{getNoteAtPosition(currentNote.stringIdx - 1, currentNote.fretNum)}</span>
        </p>

        <div className="tab-field tab-field--duration">
          <label htmlFor="tab-note-duration">Duration (seconds)</label>
          <input
            id="tab-note-duration"
            className="space-input"
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            value={currentNote.duration}
            onChange={(e) => setCurrentNote(prev => ({ ...prev, duration: parseFloat(e.target.value) }))}
          />
        </div>

        <button type="button" className="btn-ghost" onClick={handleAddNote}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Add note
        </button>
      </div>
    </div>
  );

  const TabNotesDisplay = ({ notes }) => (
    <div className="tab-preview">
      <div className="tab-section-head">
        <h3>Your tab <span className="tab-count">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span></h3>
        {notes.length > 0 && <p>Notes play left to right. Remove any note with the cross under it.</p>}
      </div>

      {notes.length === 0 ? (
        <p className="tab-empty">No notes yet. Pick a fret above and press Add note.</p>
      ) : (
        <div className="tab-staff-scroll">
          <div className="tab-staff tab-staff--preview">
            <div className="tab-preview-names" aria-hidden="true">
              {STAFF_ROWS.map(stringNum => (
                <span key={stringNum} className="tab-staff-name">{stringLabel(stringNum)}</span>
              ))}
            </div>
            <ol className="tab-preview-cols">
              {notes.map((note, index) => (
                <li key={index} className="tab-col">
                  <div className="tab-col-lines">
                    {STAFF_ROWS.map(stringNum => (
                      <span key={stringNum} className="tab-col-line">
                        {note.stringIdx === stringNum && (
                          <span className="tab-col-fret">{note.fretNum}</span>
                        )}
                      </span>
                    ))}
                  </div>
                  <span className="tab-col-meta">{note.note}</span>
                  <span className="tab-col-meta tab-col-dur">{note.duration}s</span>
                  <button
                    type="button"
                    className="tab-col-remove"
                    onClick={() => handleRemoveNote(index)}
                    aria-label={`Remove note ${index + 1}: ${stringName(note.stringIdx)}, fret ${note.fretNum}`}
                  >
                    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                      <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );

  if (!currentUser) {
    return (
      <div className="tabs-page">
        <header className="page-head">
          <h1>Tabs</h1>
          <p>Log in to write your own tabs and keep them for Play along.</p>
        </header>
      </div>
    );
  }

  const canSave = !(newTab.title.trim() === '' || newTab.notes.length === 0);

  return (
    <div className="tabs-page">
      <div className="tabs-head">
        <header className="page-head">
          <h1>Tabs</h1>
          <p>Write a riff note by note on a real tab staff, then save it to play along with later.</p>
        </header>
        <button
          type="button"
          className={showCreateForm ? 'btn-ghost' : 'btn-walnut'}
          onClick={() => setShowCreateForm(!showCreateForm)}
          aria-expanded={showCreateForm}
        >
          {showCreateForm ? 'Cancel' : 'New tab'}
        </button>
      </div>

      {showCreateForm && (
        <section className="tabs-editor" aria-label="New tab">
          <div className="tab-fields">
            <div className="tab-field">
              <label htmlFor="tab-title">Title</label>
              <input
                id="tab-title"
                className="space-input"
                type="text"
                value={newTab.title}
                onChange={(e) => setNewTab(prev => ({ ...prev, title: e.target.value }))}
                placeholder="My first riff"
              />
            </div>
            <div className="tab-field">
              <label htmlFor="tab-artist">Artist <span className="tab-optional">optional</span></label>
              <input
                id="tab-artist"
                className="space-input"
                type="text"
                value={newTab.artist}
                onChange={(e) => setNewTab(prev => ({ ...prev, artist: e.target.value }))}
                placeholder="Who wrote it"
              />
            </div>
          </div>

          <GuitarTabInterface />

          <TabNotesDisplay notes={newTab.notes} />

          <div className="tabs-editor-foot">
            {!canSave && (
              <p className="tab-hint">
                {newTab.title.trim() === '' ? 'Add a title and at least one note to save.' : 'Add at least one note to save.'}
              </p>
            )}
            <button
              type="button"
              className="btn-walnut"
              onClick={handleSaveTab}
              disabled={!canSave}
            >
              Save tab
            </button>
          </div>
        </section>
      )}

      <section className="tabs-saved" aria-labelledby="tabs-saved-title">
        <h2 id="tabs-saved-title">Your tabs</h2>
        {loading ? (
          <p className="tabs-status">Loading your tabs…</p>
        ) : customTabs.length === 0 ? (
          <p className="tabs-status">You haven't saved any tabs yet. Press New tab to write your first one.</p>
        ) : (
          <ul className="tabs-list">
            {customTabs.map((tab) => (
              <li key={tab.id} className="tabs-row">
                <div className="tabs-row-text">
                  <h3 className="tabs-row-title">{tab.title}</h3>
                  {tab.artist && <p className="tabs-row-artist">{tab.artist}</p>}
                </div>
                <p className="tabs-row-meta">
                  <span>{tab.notes.length} notes</span>
                  <span>{tab.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}</span>
                </p>
                <div className="tabs-row-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      // TODO: Navigate to Play Along with this tab selected
                      console.log('Play tab:', tab);
                    }}
                  >
                    Play
                  </button>
                  <button
                    type="button"
                    className="btn-ghost tabs-delete"
                    onClick={() => handleDeleteTab(tab.id)}
                    aria-label={`Delete ${tab.title}`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default CustomTabs;
