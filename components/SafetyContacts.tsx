/**
 * Compact safety contact bar for sea locations.
 * Shows VHF emergency channel and Kystradioen phone number.
 * Pure server component — no interactivity needed.
 */
export default function SafetyContacts() {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '8px 12px',
        marginTop: '1rem',
        borderRadius: '8px',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
      }}
    >
      <span style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b' }}>
        🚨 Emergency:
      </span>
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontSize: '12px', fontWeight: 600, color: '#7f1d1d',
          padding: '2px 8px', borderRadius: '4px', backgroundColor: '#fee2e2',
        }}
      >
        VHF Ch. 16
      </span>
      <a
        href="tel:120"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontSize: '12px', fontWeight: 600, color: '#7f1d1d',
          padding: '2px 8px', borderRadius: '4px', backgroundColor: '#fee2e2',
          textDecoration: 'none',
        }}
      >
        📞 Kystradioen: 120
      </a>
    </div>
  );
}
