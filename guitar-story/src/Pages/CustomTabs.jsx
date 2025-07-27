import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CustomTabsService } from '../services/customTabsService';

const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OPEN_STRINGS = ['E', 'A', 'D', 'G', 'B', 'E']; // 6th to 1st string

function getNoteAtPosition(stringIdx, fretNum) {
  const openNoteIdx = ALL_NOTES.indexOf(OPEN_STRINGS[stringIdx]);
  const noteIdx = (openNoteIdx + fretNum) % 12;
  return ALL_NOTES[noteIdx];
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
    <div style={{
      background: 'var(--space-card-bg)',
      borderRadius: '16px',
      padding: '25px',
      marginBottom: '25px',
      border: '1px solid var(--space-border)',
      boxShadow: '0 0 40px 5px var(--space-shadow)',
      color: 'var(--space-text)'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '25px' }}>
        <h3 style={{ 
          color: 'var(--space-star)', 
          marginBottom: '10px', 
          fontSize: '1.8rem',
          fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
          fontWeight: '600',
          letterSpacing: '0.5px',
          textShadow: '0 0 8px var(--space-accent)'
        }}>Guitar Tab Creator</h3>
        <p style={{ 
          color: 'var(--space-text)', 
          margin: 0,
          fontSize: '1.1rem',
          textShadow: '0 0 4px var(--space-shadow)'
        }}>Click on the fretboard to add notes to your tab</p>
      </div>
      
      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
        {/* String labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '30px' }}>
          {[6, 5, 4, 3, 2, 1].map(stringNum => (
            <div key={stringNum} style={{
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--space-shadow)',
              color: 'var(--space-star)',
              borderRadius: '50%',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
              letterSpacing: '0.5px',
              boxShadow: '0 0 8px var(--space-shadow)'
            }}>
              {stringNum}
            </div>
          ))}
        </div>

        {/* Fretboard */}
        <div style={{
          flex: 1,
          background: 'var(--space-card-bg)',
          borderRadius: '10px',
          padding: '20px',
          border: '2px solid var(--space-border)',
          boxShadow: '0 0 16px var(--space-shadow)'
        }}>
          {/* Fret numbers */}
          <div style={{ display: 'flex', marginBottom: '15px', gap: '8px' }}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(fret => (
              <div key={fret} style={{
                flex: 1,
                textAlign: 'center',
                color: 'var(--space-star)',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                padding: '5px',
                fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
                letterSpacing: '0.5px'
              }}>
                {fret}
              </div>
            ))}
          </div>

          {/* Strings and frets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[6, 5, 4, 3, 2, 1].map(stringNum => (
              <div key={stringNum} style={{ display: 'flex', gap: '8px', height: '35px' }}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(fret => {
                  const noteName = getNoteAtPosition(stringNum - 1, fret);
                  const isSelected = currentNote.stringIdx === stringNum && currentNote.fretNum === fret;
                  
                  return (
                    <div
                      key={`${stringNum}-${fret}`}
                      onClick={() => setCurrentNote({ stringIdx: stringNum, fretNum: fret, duration: 1 })}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isSelected ? 'var(--space-accent)' : 'var(--space-shadow)',
                        border: `1px solid ${isSelected ? 'var(--space-star)' : 'var(--space-border)'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.25s',
                        position: 'relative',
                        overflow: 'hidden',
                        boxShadow: isSelected ? '0 0 15px var(--space-star)' : '0 0 8px var(--space-shadow)'
                      }}
                    >
                      <span style={{
                        color: isSelected ? 'var(--space-shadow)' : 'var(--space-star)',
                        fontWeight: 'bold',
                        fontSize: '0.8rem',
                        textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
                        fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
                        letterSpacing: '0.5px'
                      }}>{noteName}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Current note display */}
      <div style={{
        background: 'var(--space-card-bg)',
        borderRadius: '16px',
        padding: '25px',
        marginTop: '25px',
        border: '1px solid var(--space-border)',
        boxShadow: '0 0 40px 5px var(--space-shadow)',
        color: 'var(--space-text)'
      }}>
        <h4 style={{ 
          color: 'var(--space-star)', 
          marginBottom: '15px', 
          fontSize: '1.2rem',
          fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
          fontWeight: '600',
          letterSpacing: '0.5px',
          textShadow: '0 0 8px var(--space-accent)'
        }}>Current Note:</h4>
        <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
          <span style={{ 
            color: 'var(--space-text)', 
            fontWeight: '600',
            fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
            letterSpacing: '0.5px'
          }}>String {currentNote.stringIdx}, Fret {currentNote.fretNum}</span>
          <span style={{ 
            color: 'var(--space-text)', 
            fontWeight: '600',
            fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
            letterSpacing: '0.5px'
          }}>Note: {getNoteAtPosition(currentNote.stringIdx - 1, currentNote.fretNum)}</span>
        </div>
        
        <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
          <label style={{ 
            color: 'var(--space-text)', 
            fontWeight: '600',
            fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
            letterSpacing: '0.5px'
          }}>Duration (seconds):</label>
          <input
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            value={currentNote.duration}
            onChange={(e) => setCurrentNote(prev => ({ ...prev, duration: parseFloat(e.target.value) }))}
            style={{
              width: '100px',
              padding: '10px',
              border: '2px solid var(--space-border)',
              borderRadius: '8px',
              background: 'var(--space-shadow)',
              color: 'var(--space-star)',
              fontSize: '1rem',
              transition: 'border-color 0.25s, box-shadow 0.25s',
              fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
              fontWeight: '500',
              letterSpacing: '0.5px',
              boxShadow: '0 0 8px var(--space-shadow)'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--space-star)';
              e.target.style.boxShadow = '0 0 16px var(--space-star)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--space-border)';
              e.target.style.boxShadow = '0 0 8px var(--space-shadow)';
            }}
          />
        </div>

        <button 
          onClick={handleAddNote}
          style={{
            background: 'var(--space-btn-bg)',
            color: 'var(--space-star)',
            border: '1px solid var(--space-border)',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.25s',
            letterSpacing: '0.5px',
            fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
            boxShadow: '0 0 12px var(--space-shadow)'
          }}
          onMouseEnter={(e) => {
            e.target.style.borderColor = 'var(--space-accent2)';
            e.target.style.backgroundColor = 'var(--space-accent)';
            e.target.style.color = 'var(--space-shadow)';
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = 'var(--space-border)';
            e.target.style.backgroundColor = 'var(--space-btn-bg)';
            e.target.style.color = 'var(--space-star)';
          }}
        >
          Add Note to Tab
        </button>
      </div>
    </div>
  );

  const TabNotesDisplay = ({ notes }) => (
    <div style={{
      background: 'var(--space-card-bg)',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '20px',
      border: '1px solid var(--space-border)',
      boxShadow: '0 0 40px 5px var(--space-shadow)',
      color: 'var(--space-text)'
    }}>
      <h4 style={{ 
        color: 'var(--space-star)', 
        marginBottom: '15px', 
        fontSize: '1.3rem',
        fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
        fontWeight: '600',
        letterSpacing: '0.5px',
        textShadow: '0 0 8px var(--space-accent)'
      }}>Tab Notes ({notes.length}):</h4>
      <div style={{
        maxHeight: '300px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {notes.map((note, index) => (
          <div key={index} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            background: 'var(--space-shadow)',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid var(--space-border)',
            boxShadow: '0 0 8px var(--space-shadow)'
          }}>
            <span style={{ 
              color: 'var(--space-text)', 
              fontSize: '0.9rem',
              fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
              letterSpacing: '0.5px'
            }}>String {note.stringIdx}, Fret {note.fretNum}</span>
            <span style={{ 
              color: 'var(--space-text)', 
              fontSize: '0.9rem',
              fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
              letterSpacing: '0.5px'
            }}>Note: {note.note}</span>
            <span style={{ 
              color: 'var(--space-text)', 
              fontSize: '0.9rem',
              fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
              letterSpacing: '0.5px'
            }}>Duration: {note.duration}s</span>
            <button 
              onClick={() => handleRemoveNote(index)}
              style={{
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                width: '25px',
                height: '25px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.25s',
                marginLeft: 'auto',
                fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
                letterSpacing: '0.5px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#c0392b';
                e.target.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#e74c3c';
                e.target.style.transform = 'scale(1)';
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  if (!currentUser) {
    return (
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px',
        textAlign: 'center',
        color: 'var(--space-text)',
        fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
        fontWeight: '500',
        letterSpacing: '0.5px'
      }}>
        <h2 style={{ 
          color: 'var(--space-star)', 
          marginBottom: '20px', 
          fontSize: '2rem',
          fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
          fontWeight: '700',
          letterSpacing: '1px',
          textShadow: '0 0 10px var(--space-accent), 0 0 20px var(--space-star)'
        }}>Custom Tabs</h2>
        <p style={{ 
          color: 'var(--space-text)',
          fontSize: '1.2rem',
          textShadow: '0 0 4px var(--space-shadow)'
        }}>Please log in to create and manage your custom tabs.</p>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
      fontWeight: '500',
      letterSpacing: '0.5px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '2px solid var(--space-border)'
      }}>
        <h2 style={{ 
          color: 'var(--space-star)', 
          margin: 0, 
          fontSize: '2.5rem', 
          fontWeight: '700',
          letterSpacing: '1px',
          textShadow: '0 0 10px var(--space-accent), 0 0 20px var(--space-star)',
          fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif"
        }}>Custom Tabs</h2>
        <button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            background: 'var(--space-btn-bg)',
            color: 'var(--space-star)',
            border: '1px solid var(--space-border)',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.25s',
            letterSpacing: '0.5px',
            fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
            boxShadow: '0 0 12px var(--space-shadow)'
          }}
          onMouseEnter={(e) => {
            e.target.style.borderColor = 'var(--space-accent2)';
            e.target.style.backgroundColor = 'var(--space-accent)';
            e.target.style.color = 'var(--space-shadow)';
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = 'var(--space-border)';
            e.target.style.backgroundColor = 'var(--space-btn-bg)';
            e.target.style.color = 'var(--space-star)';
          }}
        >
          {showCreateForm ? 'Cancel' : 'Create New Tab'}
        </button>
      </div>

      {showCreateForm && (
        <div style={{
          background: 'var(--space-card-bg)',
          borderRadius: '16px',
          padding: '30px',
          marginBottom: '30px',
          border: '1px solid var(--space-border)',
          boxShadow: '0 0 40px 5px var(--space-shadow)',
          color: 'var(--space-text)'
        }}>
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ 
              color: 'var(--space-star)', 
              marginBottom: '20px', 
              fontSize: '1.5rem',
              fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
              fontWeight: '600',
              letterSpacing: '0.5px',
              textShadow: '0 0 8px var(--space-accent)'
            }}>Tab Information</h3>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ 
                  display: 'block', 
                  color: 'var(--space-text)', 
                  marginBottom: '8px', 
                  fontWeight: '600',
                  fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
                  letterSpacing: '0.5px'
                }}>Title:</label>
                <input
                  type="text"
                  value={newTab.title}
                  onChange={(e) => setNewTab(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter tab title"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid var(--space-border)',
                    borderRadius: '8px',
                    background: 'var(--space-shadow)',
                    color: 'var(--space-star)',
                    fontSize: '1rem',
                    transition: 'border-color 0.25s, box-shadow 0.25s',
                    fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
                    fontWeight: '500',
                    letterSpacing: '0.5px',
                    boxShadow: '0 0 8px var(--space-shadow)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--space-star)';
                    e.target.style.boxShadow = '0 0 16px var(--space-star)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--space-border)';
                    e.target.style.boxShadow = '0 0 8px var(--space-shadow)';
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ 
                  display: 'block', 
                  color: 'var(--space-text)', 
                  marginBottom: '8px', 
                  fontWeight: '600',
                  fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
                  letterSpacing: '0.5px'
                }}>Artist (optional):</label>
                <input
                  type="text"
                  value={newTab.artist}
                  onChange={(e) => setNewTab(prev => ({ ...prev, artist: e.target.value }))}
                  placeholder="Enter artist name"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid var(--space-border)',
                    borderRadius: '8px',
                    background: 'var(--space-shadow)',
                    color: 'var(--space-star)',
                    fontSize: '1rem',
                    transition: 'border-color 0.25s, box-shadow 0.25s',
                    fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
                    fontWeight: '500',
                    letterSpacing: '0.5px',
                    boxShadow: '0 0 8px var(--space-shadow)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--space-star)';
                    e.target.style.boxShadow = '0 0 16px var(--space-star)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--space-border)';
                    e.target.style.boxShadow = '0 0 8px var(--space-shadow)';
                  }}
                />
              </div>
            </div>
          </div>

          <GuitarTabInterface />
          
          <TabNotesDisplay notes={newTab.notes} />

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button 
              onClick={handleSaveTab}
              disabled={newTab.title.trim() === '' || newTab.notes.length === 0}
              style={{
                background: 'var(--space-btn-bg)',
                color: 'var(--space-star)',
                border: '1px solid var(--space-border)',
                padding: '15px 30px',
                borderRadius: '8px',
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: newTab.title.trim() === '' || newTab.notes.length === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.25s',
                letterSpacing: '0.5px',
                fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
                boxShadow: '0 0 12px var(--space-shadow)',
                opacity: newTab.title.trim() === '' || newTab.notes.length === 0 ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (newTab.title.trim() !== '' && newTab.notes.length > 0) {
                  e.target.style.borderColor = 'var(--space-accent2)';
                  e.target.style.backgroundColor = 'var(--space-accent)';
                  e.target.style.color = 'var(--space-shadow)';
                }
              }}
              onMouseLeave={(e) => {
                if (newTab.title.trim() !== '' && newTab.notes.length > 0) {
                  e.target.style.borderColor = 'var(--space-border)';
                  e.target.style.backgroundColor = 'var(--space-btn-bg)';
                  e.target.style.color = 'var(--space-star)';
                }
              }}
            >
              Save Tab
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: '30px' }}>
        <h3 style={{ 
          color: 'var(--space-star)', 
          marginBottom: '20px', 
          fontSize: '1.8rem',
          fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
          fontWeight: '700',
          letterSpacing: '1px',
          textShadow: '0 0 10px var(--space-accent), 0 0 20px var(--space-star)'
        }}>Your Custom Tabs</h3>
        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            color: 'var(--space-text)', 
            padding: '40px', 
            fontSize: '1.1rem',
            fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
            letterSpacing: '0.5px'
          }}>
            Loading your custom tabs...
          </div>
        ) : customTabs.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            color: 'var(--space-text)', 
            padding: '40px', 
            fontSize: '1.1rem',
            fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
            letterSpacing: '0.5px'
          }}>
            <p>You haven't created any custom tabs yet.</p>
            <p>Click "Create New Tab" to get started!</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            {customTabs.map((tab) => (
              <div key={tab.id} style={{
                background: 'var(--space-card-bg)',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid var(--space-border)',
                transition: 'all 0.25s',
                boxShadow: '0 0 40px 5px var(--space-shadow)',
                color: 'var(--space-text)'
              }}>
                <div>
                  <h4 style={{ 
                    color: 'var(--space-star)', 
                    marginBottom: '10px', 
                    fontSize: '1.3rem',
                    fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
                    fontWeight: '600',
                    letterSpacing: '0.5px',
                    textShadow: '0 0 8px var(--space-accent)'
                  }}>{tab.title}</h4>
                  {tab.artist && <p style={{ 
                    color: 'var(--space-text)', 
                    marginBottom: '8px', 
                    fontStyle: 'italic',
                    fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
                    letterSpacing: '0.5px'
                  }}>by {tab.artist}</p>}
                  <p style={{ 
                    color: 'var(--space-accent)', 
                    fontWeight: '600', 
                    marginBottom: '8px',
                    fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
                    letterSpacing: '0.5px'
                  }}>{tab.notes.length} notes</p>
                  <p style={{ 
                    color: 'var(--space-text)', 
                    fontSize: '0.9rem', 
                    marginBottom: '15px',
                    opacity: '0.7',
                    fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
                    letterSpacing: '0.5px'
                  }}>
                    Created: {tab.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    onClick={() => {
                      // TODO: Navigate to Play Along with this tab selected
                      console.log('Play tab:', tab);
                    }}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: '1px solid var(--space-border)',
                      borderRadius: '6px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.25s',
                      background: 'var(--space-btn-bg)',
                      color: 'var(--space-star)',
                      fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
                      letterSpacing: '0.5px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.borderColor = 'var(--space-accent2)';
                      e.target.style.backgroundColor = 'var(--space-accent)';
                      e.target.style.color = 'var(--space-shadow)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.borderColor = 'var(--space-border)';
                      e.target.style.backgroundColor = 'var(--space-btn-bg)';
                      e.target.style.color = 'var(--space-star)';
                    }}
                  >
                    Play
                  </button>
                  <button 
                    onClick={() => handleDeleteTab(tab.id)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: '1px solid var(--space-border)',
                      borderRadius: '6px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.25s',
                      background: '#e74c3c',
                      color: 'white',
                      fontFamily: "'Orbitron', 'Audiowide', 'Chakra Petch', 'Rajdhani', 'Exo 2', 'Montserrat', 'Arial', sans-serif",
                      letterSpacing: '0.5px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#c0392b';
                      e.target.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#e74c3c';
                      e.target.style.transform = 'translateY(0)';
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomTabs; 