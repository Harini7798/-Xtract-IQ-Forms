import React, { useRef, useState, useEffect, useMemo } from "react";
import { Upload, FileText, CheckCircle, Database, Sparkles, Server, Clock, AlertTriangle, Layers, ArrowRight } from "lucide-react";
import { MaterialReactTable, useMaterialReactTable } from "material-react-table";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, ThemeProvider, createTheme, CssBaseline, Box, Typography } from '@mui/material';

// API URL from environment variable
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Custom dark theme for Material UI integration
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1', // Indigo Accent
      light: '#818cf8',
      dark: '#4f46e5',
    },
    secondary: {
      main: '#06b6d4', // Cyan accent
    },
    background: {
      default: '#070b13',
      paper: '#0f172a',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
    },
  },
  typography: {
    fontFamily: "'Outfit', 'Plus Jakarta Sans', -apple-system, sans-serif",
    h6: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '10px',
          fontWeight: 600,
          padding: '8px 18px',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '10px',
            backgroundColor: 'rgba(2, 6, 23, 0.4)',
            transition: 'all 0.2s',
            '&:hover': {
              backgroundColor: 'rgba(2, 6, 23, 0.6)',
            },
          },
        },
      },
    },
  },
});

function App() {
  const fileInputRef = useRef();
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  
  // State for editing nested objects
  const [editModal, setEditModal] = useState({ open: false, rowIdx: null, col: null, value: null });

  // Fetch documents from backend
  const fetchDocuments = async () => {
    try {
      setError("");
      const res = await fetch(`${API_URL}/api/all-documents`);
      const data = await res.json();
      setDocuments(data.data || []);
    } catch (err) {
      setError("Failed to fetch documents: " + err.message);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUploadClick = () => fileInputRef.current.click();

  // Helper for processing uploads
  const uploadFiles = async (files) => {
    if (!files.length) return;
    setUploading(true);
    setFeedback("");
    setError("");

    // Separate files by type
    const pdfFiles = files.filter(file => file.type === "application/pdf");
    const imageFiles = files.filter(file => file.type !== "application/pdf");

    let feedbackMsg = "";
    try {
      // Upload PDFs in batch if any
      if (pdfFiles.length) {
        const formData = new FormData();
        pdfFiles.forEach(file => formData.append("files", file));
        const res = await fetch(`${API_URL}/api/upload-scanned-pdfs`, {
          method: "POST",
          body: formData,
        });
        const result = await res.json();
        if (result.data) {
          setDocuments(result.data);
          feedbackMsg += "PDF documents extracted successfully! ";
        } else {
          setError("PDF extraction failed: " + (result.error || "Unknown error"));
        }
      }
      // Upload images in batch if any
      if (imageFiles.length) {
        const formData = new FormData();
        imageFiles.forEach(file => formData.append("files", file));
        const res = await fetch(`${API_URL}/api/upload-images`, {
          method: "POST",
          body: formData,
        });
        const result = await res.json();
        if (result.data) {
          setDocuments(result.data);
          feedbackMsg += "Images extracted successfully!";
        } else {
          setError("Image extraction failed: " + (result.error || "Unknown error"));
        }
      }
      if (feedbackMsg) {
        setFeedback(feedbackMsg.trim());
      }
    } catch (err) {
      setError("Upload failed: " + err.message);
    }
    setUploading(false);
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    await uploadFiles(files);
    e.target.value = null;
  };

  // Drag-and-drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files);
  };

  // Recursive SubTable component for nested JSON rendering (code-editor theme)
  const SubTable = ({ data }) => {
    let parsed = data;
    if (typeof data === 'string') {
      try {
        const tryParsed = JSON.parse(data);
        if (typeof tryParsed === 'object' && tryParsed !== null) {
          parsed = tryParsed;
        } else {
          return <span style={styles.codeText}>{String(data)}</span>;
        }
      } catch {
        try {
          const tryParsed = JSON.parse(data.replace(/'/g, '"'));
          if (typeof tryParsed === 'object' && tryParsed !== null) {
            parsed = tryParsed;
          } else {
            return <span style={styles.codeText}>{String(data)}</span>;
          }
        } catch {
          return <span style={styles.codeText}>{String(data)}</span>;
        }
      }
    }
    if (!parsed || typeof parsed !== 'object') return <span style={styles.codeText}>{String(parsed)}</span>;
    const entries = Array.isArray(parsed)
      ? parsed.map((v, i) => [i, v])
      : Object.entries(parsed);
      
    return (
      <div style={styles.subtableContainer}>
        <table style={styles.subtable}>
          <tbody>
            {entries.map(([key, value]) => (
              <tr key={key} style={styles.subtableRow}>
                <td style={styles.subtableKey}>{key}</td>
                <td style={styles.subtableValue}>
                  {typeof value === 'object' && value !== null
                    ? <SubTable data={value} />
                    : typeof value === 'string'
                      ? <SubTable data={value} />
                      : String(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Helper to recursively render editable fields for an object
  const renderEditFields = (obj, path = []) => {
    return Object.entries(obj).map(([key, value]) => {
      const fieldPath = [...path, key];
      if (typeof value === 'object' && value !== null) {
        return (
          <div key={fieldPath.join('.')} style={styles.nestedFieldGroup}>
            <div style={styles.nestedFieldLabel}>{key}</div>
            <div style={{ paddingLeft: 12 }}>
              {renderEditFields(value, fieldPath)}
            </div>
          </div>
        );
      }
      return (
        <TextField
          key={fieldPath.join('.')}
          label={key}
          value={value ?? ''}
          size="small"
          margin="dense"
          fullWidth
          variant="outlined"
          sx={{ marginBottom: 2 }}
          onChange={e => {
            const newValue = e.target.value;
            setEditModal(prev => {
              const updated = { ...prev.value };
              let ref = updated;
              for (let i = 0; i < fieldPath.length - 1; i++) {
                ref[fieldPath[i]] = { ...ref[fieldPath[i]] };
                ref = ref[fieldPath[i]];
              }
              ref[fieldPath[fieldPath.length - 1]] = newValue;
              return { ...prev, value: updated };
            });
          }}
        />
      );
    });
  };

  // Save handler for modal
  const handleModalSave = () => {
    if (editModal.rowIdx !== null && editModal.col) {
      setDocuments(prevDocs => {
        const updated = [...prevDocs];
        updated[editModal.rowIdx] = {
          ...updated[editModal.rowIdx],
          [editModal.col]: editModal.value
        };
        return updated;
      });
    }
    setEditModal({ open: false, rowIdx: null, col: null, value: null });
  };

  // Cancel handler for modal
  const handleModalCancel = () => {
    setEditModal({ open: false, rowIdx: null, col: null, value: null });
  };

  // Define MRT columns dynamically
  const columns = useMemo(() =>
    documents.length > 0
      ? Object.keys(documents[0]).map((key) => ({
          accessorKey: key,
          header: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          Cell: ({ cell, row }) => {
            let value = cell.getValue();
            if (typeof value === 'string' && (value.trim().startsWith('{') || value.trim().startsWith('['))) {
              try {
                const parsed = JSON.parse(value);
                if (typeof parsed === 'object' && parsed !== null) {
                  value = parsed;
                }
              } catch {
                try {
                  const parsed = JSON.parse(value.replace(/'/g, '"'));
                  if (typeof parsed === 'object' && parsed !== null) {
                    value = parsed;
                  }
                } catch {}
              }
            }
            if (typeof value === 'object' && value !== null) {
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <SubTable data={value} />
                  <div>
                    <Button
                      variant="outlined"
                      size="small"
                      color="primary"
                      onClick={() => setEditModal({ open: true, rowIdx: row.index, col: key, value: value })}
                      startIcon={<Layers size={14} />}
                      sx={{ fontSize: '0.75rem', py: 0.5 }}
                    >
                      Edit Schema
                    </Button>
                  </div>
                </div>
              );
            }
            return <span style={styles.primitiveText}>{String(value)}</span>;
          },
          // Enable editing only for primitives
          enableEditing: (row) => {
            const value = row.original[key];
            return typeof value !== 'object';
          }
        }))
      : [],
    [documents]
  );

  // MRT cell editing save handler
  const handleSaveCell = async ({ row, column, value }) => {
    const updatedDocs = [...documents];
    updatedDocs[row.index] = { ...updatedDocs[row.index], [column.id]: value };
    setDocuments(updatedDocs);
  };

  const table = useMaterialReactTable({
    columns,
    data: documents,
    enableEditing: true,
    editDisplayMode: 'cell',
    onEditingCellSave: handleSaveCell,
    muiTablePaperProps: {
      sx: {
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '20px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden',
      },
    },
    muiTableContainerProps: {
      sx: {
        maxHeight: 520,
      },
    },
    muiTableBodyCellProps: {
      sx: {
        fontFamily: "'Outfit', sans-serif",
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        py: 2,
        px: 2.5,
        color: '#e2e8f0',
      },
    },
    muiTableHeadCellProps: {
      sx: {
        fontFamily: "'Outfit', sans-serif",
        fontWeight: 600,
        fontSize: '0.9rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        backgroundColor: '#0f172a',
        borderBottom: '1.5px solid rgba(255, 255, 255, 0.1)',
        color: '#94a3b8',
        py: 2,
        px: 2.5,
      },
    },
    muiTableBodyRowProps: {
      sx: {
        backgroundColor: 'transparent',
        transition: 'background-color 0.2s',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.02) !important',
        },
      },
    },
    state: {
      isLoading: uploading,
    },
  });

  // Save verified data to after_verify DB
  const handleSaveVerified = async () => {
    setSaving(true);
    setFeedback("");
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/save-verified`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: documents })
      });
      const result = await res.json();
      if (res.ok) {
        setFeedback("Verified data saved to permanent database successfully!");
      } else {
        setError(result.error || "Failed to save verified data. Note: verification endpoint must be configured on backend.");
      }
    } catch (err) {
      setError("Failed to save verified data: " + err.message);
    }
    setSaving(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={styles.container}>
        <div style={styles.gridOverlay}></div>
        <div style={styles.glowRadial}></div>
        
        <div style={styles.content}>
          {/* Top Navbar / Branding */}
          <div style={styles.navbar}>
            <div style={styles.navbarBrand}>
              <div style={styles.brandLogo}>
                <Sparkles style={{ width: 18, height: 18, color: '#fff' }} />
              </div>
              <span style={styles.brandName}>XtractIQ</span>
            </div>
            
            <div style={styles.sysStatusContainer}>
              <div style={styles.pulseIndicator}></div>
              <span style={styles.statusLabel}>Engine Operational</span>
            </div>
          </div>

          {/* Hero Section */}
          <div style={styles.hero}>
            <h1 style={styles.heroTitle}>
              AI-Powered Form <span style={styles.titleGradient}>Data Extractor</span>
            </h1>
            <p style={styles.heroSubtitle}>
              Instantly transform scanned PDFs and form images into structured database-ready formats.
            </p>
          </div>

          {/* Stats Dashboard Grid */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statIconWrapper}>
                <Database style={{ width: 18, height: 18, color: '#6366f1' }} />
              </div>
              <div>
                <div style={styles.statLabel}>Documents Extracted</div>
                <div style={styles.statValue}>{documents.length}</div>
              </div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statIconWrapper}>
                <Server style={{ width: 18, height: 18, color: '#06b6d4' }} />
              </div>
              <div>
                <div style={styles.statLabel}>Extraction Pipeline</div>
                <div style={styles.statValue}>Azure Read API</div>
              </div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statIconWrapper}>
                <Sparkles style={{ width: 18, height: 18, color: '#8b5cf6' }} />
              </div>
              <div>
                <div style={styles.statLabel}>LLM Processor</div>
                <div style={styles.statValue}>Llama 3.3 (Groq)</div>
              </div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statIconWrapper}>
                <Clock style={{ width: 18, height: 18, color: '#10b981' }} />
              </div>
              <div>
                <div style={styles.statLabel}>Database Connection</div>
                <div style={{ ...styles.statValue, color: '#10b981', fontSize: '1rem', fontWeight: 600, marginTop: 4 }}>
                  Neon Cloud DB
                </div>
              </div>
            </div>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div style={styles.uploadContainer}>
            <div 
              style={{
                ...styles.dropZone,
                ...(isDragActive ? styles.dropZoneActive : {}),
                ...(uploading ? styles.dropZoneUploading : {})
              }}
              onClick={handleUploadClick}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
              />
              
              <div style={styles.dropZoneGlow}></div>
              
              <div style={{
                ...styles.uploadIconCircle,
                ...(uploading ? styles.uploadIconCircleAnimating : {})
              }}>
                {uploading ? (
                  <div style={styles.progressRing}></div>
                ) : (
                  <Upload style={{ width: 28, height: 28, color: '#818cf8' }} />
                )}
              </div>

              <div style={styles.uploadInstruction}>
                {uploading ? (
                  <div>
                    <h3 style={styles.uploadTextTitleActive}>Extracting text and schema...</h3>
                    <p style={styles.uploadTextDesc}>Our neural network is structuring your form fields</p>
                  </div>
                ) : (
                  <div>
                    <h3 style={styles.uploadTextTitle}>
                      {isDragActive ? "Drop files to begin extraction!" : "Drag & drop files here, or browse files"}
                    </h3>
                    <p style={styles.uploadTextDesc}>
                      Supports PDF, PNG, JPG, and JPEG formats (Max 10MB per document)
                    </p>
                  </div>
                )}
              </div>

              <div style={styles.badgeRow}>
                {['PDF', 'PNG', 'JPEG', 'JPG'].map(tag => (
                  <span key={tag} style={styles.badge}>{tag}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Messages System */}
          {feedback && (
            <div style={styles.alertWrapper}>
              <div style={styles.alertSuccess}>
                <CheckCircle style={{ width: 20, height: 20, color: '#34d399', flexShrink: 0 }} />
                <span style={styles.alertText}>{feedback}</span>
              </div>
            </div>
          )}

          {error && (
            <div style={styles.alertWrapper}>
              <div style={styles.alertError}>
                <AlertTriangle style={{ width: 20, height: 20, color: '#f87171', flexShrink: 0 }} />
                <span style={styles.alertText}>{error}</span>
              </div>
            </div>
          )}

          {/* Table Visual Wrapper */}
          <div style={styles.tableBlock}>
            <div style={styles.tableBlockHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={styles.tableBlockIcon}>
                  <FileText style={{ width: 20, height: 20, color: '#6366f1' }} />
                </div>
                <div>
                  <h2 style={styles.tableBlockTitle}>Document Registry</h2>
                  <p style={styles.tableBlockSubtitle}>Verify, edit, and audit machine-extracted schemas</p>
                </div>
              </div>
              {documents.length > 0 && (
                <button 
                  onClick={() => setDocuments([])}
                  style={styles.resetBtn}
                >
                  Clear All
                </button>
              )}
            </div>

            <div style={styles.tableSurface}>
              {documents.length > 0 ? (
                <MaterialReactTable table={table} />
              ) : (
                <div style={styles.emptyGrid}>
                  <div style={styles.emptyIconContainer}>
                    <Database style={{ width: 32, height: 32, color: '#475569' }} />
                  </div>
                  <h3 style={styles.emptyTitle}>No extracted data yet</h3>
                  <p style={styles.emptyDesc}>
                    Upload a scanned form document above to populate this registry table.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Action Footer */}
          {documents.length > 0 && (
            <div style={styles.actionRow}>
              <button
                onClick={handleSaveVerified}
                disabled={saving}
                style={{
                  ...styles.primaryActionBtn,
                  ...(saving ? styles.primaryActionBtnDisabled : {})
                }}
              >
                <span>{saving ? 'Syncing...' : 'Persist Verified Data'}</span>
                <ArrowRight style={{ width: 18, height: 18 }} />
              </button>
            </div>
          )}

          {/* Edit Modal for nested JSON schemas */}
          <Dialog open={editModal.open} onClose={handleModalCancel} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 700, color: '#f8fafc', background: '#0b0f19', borderBottom: '1px solid rgba(255,255,255,0.08)', px: 3, py: 2.5 }}>
              <Box display="flex" alignItems="center" gap={1}>
                <Layers size={18} color="#6366f1" />
                <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
                  {editModal.col
                    ? `Edit Fields: ${editModal.col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`
                    : 'Edit Nested schema'}
                </Typography>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ padding: 3.5, background: '#0f172a', mt: 1.5 }}>
              {editModal.value && typeof editModal.value === 'object' ? renderEditFields(editModal.value) : null}
            </DialogContent>
            <DialogActions sx={{ background: '#0b0f19', borderTop: '1px solid rgba(255,255,255,0.08)', px: 3, py: 2 }}>
              <Button onClick={handleModalCancel} variant="outlined" color="inherit" sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#94a3b8', '&:hover': { borderColor: 'rgba(255,255,255,0.3)' } }}>
                Cancel
              </Button>
              <Button onClick={handleModalSave} variant="contained" color="primary" sx={{ boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)' }}>
                Save Schema
              </Button>
            </DialogActions>
          </Dialog>
        </div>
      </div>
    </ThemeProvider>
  );
}

// Complete styles object driving the premium dark glassmorphic layout
const styles = {
  container: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at 50% 0%, #101524 0%, #060913 100%)',
    position: 'relative',
    color: '#e2e8f0',
    overflowX: 'hidden',
  },
  gridOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'radial-gradient(rgba(99, 102, 241, 0.04) 1px, transparent 0), radial-gradient(rgba(255, 255, 255, 0.01) 1.5px, transparent 0)',
    backgroundSize: '30px 30px',
    backgroundPosition: '0 0, 15px 15px',
    zIndex: 1,
  },
  glowRadial: {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '80%',
    height: '600px',
    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0.01) 60%, transparent 100%)',
    zIndex: 2,
    pointerEvents: 'none',
  },
  content: {
    position: 'relative',
    zIndex: 10,
    maxWidth: '1280px',
    width: '90%',
    margin: '0 auto',
    padding: '1.5rem 0 4rem 0',
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    backdropFilter: 'blur(10px)',
    marginBottom: '3.5rem',
  },
  navbarBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  brandLogo: {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)',
  },
  brandName: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '1.25rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: '#ffffff',
  },
  sysStatusContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    border: '1px solid rgba(16, 185, 129, 0.15)',
    borderRadius: '20px',
  },
  pulseIndicator: {
    width: '8px',
    height: '8px',
    backgroundColor: '#10b981',
    borderRadius: '50%',
    boxShadow: '0 0 10px #10b981',
    animation: 'pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  },
  statusLabel: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#34d399',
    letterSpacing: '0.02em',
  },
  hero: {
    textAlign: 'center',
    marginBottom: '3rem',
  },
  heroTitle: {
    fontSize: '3.25rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color: '#ffffff',
    margin: '0 0 12px 0',
    lineHeight: 1.15,
  },
  titleGradient: {
    background: 'linear-gradient(135deg, #a5b4fc 10%, #6366f1 50%, #4f46e5 90%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroSubtitle: {
    fontSize: '1.15rem',
    color: '#94a3b8',
    maxWidth: '560px',
    margin: '0 auto',
    lineHeight: 1.5,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1.25rem',
    marginBottom: '2.5rem',
  },
  statCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    padding: '20px',
    backdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    transition: 'transform 0.2s, border-color 0.2s',
    '&:hover': {
      transform: 'translateY(-2px)',
      borderColor: 'rgba(99, 102, 241, 0.2)',
    },
  },
  statIconWrapper: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: '0.8rem',
    fontWeight: 500,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#f8fafc',
    marginTop: '2px',
  },
  uploadContainer: {
    marginBottom: '3.5rem',
  },
  dropZone: {
    position: 'relative',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    border: '1.5px dashed rgba(255, 255, 255, 0.12)',
    borderRadius: '24px',
    padding: '3.5rem 2rem',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    backdropFilter: 'blur(12px)',
    overflow: 'hidden',
  },
  dropZoneActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    boxShadow: '0 0 25px rgba(99, 102, 241, 0.15)',
    transform: 'scale(1.01)',
  },
  dropZoneUploading: {
    borderColor: '#06b6d4',
    backgroundColor: 'rgba(6, 182, 212, 0.03)',
    cursor: 'default',
  },
  dropZoneGlow: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.06) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  uploadIconCircle: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    border: '1.5px solid rgba(99, 102, 241, 0.2)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.5rem',
    position: 'relative',
    zIndex: 5,
    transition: 'transform 0.3s',
  },
  uploadIconCircleAnimating: {
    border: '1.5px solid transparent',
  },
  progressRing: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(6, 182, 212, 0.15)',
    borderTop: '3px solid #06b6d4',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  uploadInstruction: {
    position: 'relative',
    zIndex: 5,
    marginBottom: '1.5rem',
  },
  uploadTextTitle: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '1.35rem',
    fontWeight: 600,
    color: '#ffffff',
    margin: '0 0 8px 0',
  },
  uploadTextTitleActive: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '1.35rem',
    fontWeight: 600,
    color: '#06b6d4',
    margin: '0 0 8px 0',
  },
  uploadTextDesc: {
    fontSize: '0.95rem',
    color: '#64748b',
    margin: 0,
  },
  badgeRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    position: 'relative',
    zIndex: 5,
  },
  badge: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#94a3b8',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    padding: '4px 12px',
    borderRadius: '12px',
    letterSpacing: '0.02em',
  },
  alertWrapper: {
    marginBottom: '1.5rem',
    animation: 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  alertSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    padding: '14px 20px',
    borderRadius: '14px',
    color: '#a7f3d0',
  },
  alertError: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    padding: '14px 20px',
    borderRadius: '14px',
    color: '#fca5a5',
  },
  alertText: {
    fontSize: '0.95rem',
    fontWeight: 500,
  },
  tableBlock: {
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '24px',
    overflow: 'hidden',
    boxShadow: '0 30px 60px rgba(0, 0, 0, 0.2)',
    backdropFilter: 'blur(20px)',
  },
  tableBlockHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    background: 'linear-gradient(90deg, rgba(15, 23, 42, 0.4) 0%, transparent 100%)',
  },
  tableBlockIcon: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    border: '1.5px solid rgba(99, 102, 241, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableBlockTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#ffffff',
    margin: 0,
  },
  tableBlockSubtitle: {
    fontSize: '0.85rem',
    color: '#64748b',
    margin: '2px 0 0 0',
  },
  resetBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '8px',
    color: '#f87171',
    padding: '6px 14px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    '&:hover': {
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
    },
  },
  tableSurface: {
    padding: '4px',
  },
  emptyGrid: {
    textAlign: 'center',
    padding: '5rem 2rem',
  },
  emptyIconContainer: {
    width: '64px',
    height: '64px',
    borderRadius: '20px',
    backgroundColor: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1.25rem auto',
  },
  emptyTitle: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '1.2rem',
    fontWeight: 600,
    color: '#cbd5e1',
    margin: '0 0 6px 0',
  },
  emptyDesc: {
    fontSize: '0.9rem',
    color: '#475569',
    maxWidth: '360px',
    margin: '0 auto',
    lineHeight: 1.4,
  },
  actionRow: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '2.5rem',
  },
  primaryActionBtn: {
    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    color: 'white',
    padding: '12px 36px',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(99, 102, 241, 0.35)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    transition: 'all 0.2s',
    '&:hover': {
      transform: 'translateY(-1px)',
      boxShadow: '0 6px 24px rgba(99, 102, 241, 0.45)',
    },
    '&:active': {
      transform: 'translateY(1px)',
    },
  },
  primaryActionBtnDisabled: {
    background: 'rgba(255,255,255,0.05)',
    color: '#475569',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  primitiveText: {
    fontSize: '0.92rem',
    color: '#e2e8f0',
  },
  subtableContainer: {
    backgroundColor: '#090d16',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '10px 14px',
    margin: '4px 0',
    width: '100%',
    overflowX: 'auto',
  },
  subtable: {
    borderCollapse: 'collapse',
    width: '100%',
    fontFamily: '"JetBrains Mono", Consolas, "Liberation Mono", Courier, monospace',
    fontSize: '0.82rem',
  },
  subtableRow: {
    borderBottom: '1.5px solid rgba(255,255,255,0.03)',
  },
  subtableKey: {
    color: '#818cf8',
    fontWeight: 600,
    padding: '5px 8px 5px 0',
    verticalAlign: 'top',
    whiteSpace: 'nowrap',
  },
  subtableValue: {
    color: '#cbd5e1',
    padding: '5px 0 5px 8px',
  },
  codeText: {
    fontFamily: '"JetBrains Mono", Consolas, monospace',
    fontSize: '0.82rem',
    color: '#34d399',
  },
  nestedFieldGroup: {
    marginLeft: 12,
    marginBottom: 20,
    padding: '12px 16px',
    backgroundColor: 'rgba(2, 6, 23, 0.3)',
    border: '1.5px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
  },
  nestedFieldLabel: {
    fontWeight: 700,
    fontSize: '0.9rem',
    color: '#818cf8',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  }
};

// Add standard keyframes animations into head for maximum flexibility
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(0.95); }
  }

  /* Scrollbars styling for a unified interface experience */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  /* Force table grid container background to transparent */
  .MuiTableContainer-root {
    background-color: transparent !important;
  }
`;
document.head.appendChild(styleSheet);

export default App;