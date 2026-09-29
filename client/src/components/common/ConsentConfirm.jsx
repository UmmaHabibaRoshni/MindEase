import { useState } from 'react';

function ConsentConfirm({ ngoName, onConfirm, onCancel }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div style={styles.overlay}>
      <div style={styles.box}>
        <h3>Share your request with {ngoName}?</h3>
        <p>
          Only your request category, urgency and description will be shared.
          Your name and contact details will not be shared.
        </p>
        <label>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />{' '}
          I agree to share this information.
        </label>
        <div style={styles.buttons}>
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onConfirm} disabled={!agreed}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  box: { background: '#fff', color: '#111', padding: '24px', borderRadius: '8px', maxWidth: '420px' },
  buttons: { display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'flex-end' },
};

export default ConsentConfirm;