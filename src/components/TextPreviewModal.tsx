interface TextPreviewModalProps {
  showPreview: boolean;
  previewText: string | null;
  onClose: () => void;
}

export default function TextPreviewModal({ showPreview, previewText, onClose }: TextPreviewModalProps) {
  if (!showPreview) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: "white",
        borderRadius: "8px",
        padding: "1.5rem",
        maxWidth: "80vw",
        maxHeight: "80vh",
        overflow: "auto",
        position: "relative"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem"
        }}>
          <h3>Extracted Text Preview</h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              padding: "0.25rem"
            }}
          >
            ×
          </button>
        </div>
        <div style={{
          backgroundColor: "#f8f9fa",
          padding: "1rem",
          borderRadius: "4px",
          border: "1px solid #e9ecef",
          maxHeight: "60vh",
          overflow: "auto",
          whiteSpace: "pre-wrap",
          fontFamily: "monospace",
          fontSize: "0.9rem",
          lineHeight: "1.4"
        }}>
          {previewText}
        </div>
        <div style={{
          marginTop: "1rem",
          textAlign: "right"
        }}>
          <button
            onClick={onClose}
            className="secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}