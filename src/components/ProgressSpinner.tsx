interface ProgressSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

export default function ProgressSpinner({ message = "Processing...", size = 'medium' }: ProgressSpinnerProps) {
  const sizeMap = {
    small: '16px',
    medium: '24px',
    large: '32px'
  };

  const spinnerSize = sizeMap[size];

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      color: '#6b7280'
    }}>
      <div
        style={{
          width: spinnerSize,
          height: spinnerSize,
          border: '2px solid #f3f4f6',
          borderTop: '2px solid #8b5cf6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}
      />
      <span style={{ fontSize: size === 'small' ? '0.75rem' : size === 'large' ? '1.1rem' : '0.9rem' }}>
        {message}
      </span>
    </div>
  );
}