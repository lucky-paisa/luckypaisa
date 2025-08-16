import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useLocation } from 'react-router-dom';


const Signup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const referralId = searchParams.get("ref") || null;
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Sign Up | Lucky Paisa';
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      return setError("Passwords do not match.");
    }

    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const user = userCredential.user;

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        joinedAt: new Date(),
        referenceBy: referralId ? referralId : "SELF", // store inviter UID or SELF
      });

      navigate('/login');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Email already exists');
      } else {
        setError('Signup failed. Please try again.');
      }
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.overlay}></div>
      <div style={styles.card} className="fade-in">
        <h2 style={styles.title}>Create Your Account</h2>
        {error && <p style={styles.error}>{error}</p>}
        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Name */}
          <div style={styles.floatingGroup}>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              onFocus={() => setFocused({ ...focused, name: true })}
              onBlur={() => setFocused({ ...focused, name: false })}
              required
              style={styles.floatingInput}
            />
            {!(formData.name || focused.name) && (
              <label style={styles.floatingLabel}>Full Name</label>
            )}
          </div>

          {/* Email */}
          <div style={styles.floatingGroup}>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              onFocus={() => setFocused({ ...focused, email: true })}
              onBlur={() => setFocused({ ...focused, email: false })}
              required
              style={styles.floatingInput}
            />
            {!(formData.email || focused.email) && (
              <label style={styles.floatingLabel}>Email</label>
            )}
          </div>

          {/* Phone */}
          <div style={styles.floatingGroup}>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              onFocus={() => setFocused({ ...focused, phone: true })}
              onBlur={() => setFocused({ ...focused, phone: false })}
              required
              style={styles.floatingInput}
            />
            {!(formData.phone || focused.phone) && (
              <label style={styles.floatingLabel}>Phone Number</label>
            )}
          </div>

          {/* Password */}
          <div style={styles.floatingGroup}>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleChange}
              onFocus={() => setFocused({ ...focused, password: true })}
              onBlur={() => setFocused({ ...focused, password: false })}
              required
              style={styles.floatingInput}
            />
            {!(formData.password || focused.password) && (
              <label style={styles.floatingLabel}>Password</label>
            )}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={styles.toggleBtn}
            >
              {showPassword ? '👁' : '⌣'}
            </button>
          </div>

          {/* Confirm Password */}
          <div style={styles.floatingGroup}>
            <input
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              onFocus={() => setFocused({ ...focused, confirmPassword: true })}
              onBlur={() => setFocused({ ...focused, confirmPassword: false })}
              required
              style={styles.floatingInput}
            />
            {!(formData.confirmPassword || focused.confirmPassword) && (
              <label style={styles.floatingLabel}>Confirm Password</label>
            )}
          </div>

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>

        <p style={styles.footerText}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#60a5fa' }}>Login</a>
        </p>
      </div>

      <style>
        {`
          .fade-in {
            animation: fadeIn 1s ease-out;
          }
          @keyframes fadeIn {
            0% { opacity: 0; transform: translateY(30px); }
            100% { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
};

const styles = {
  container: {
    position: 'relative',
    minHeight: '100vh',
    background: 'linear-gradient(to bottom right, #0f2027, #203a43, #2c5364)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '1rem'
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.3)',
    zIndex: 1
  },
  card: {
    position: 'relative',
    zIndex: 2,
    background: '#1f2937',
    color: '#f3f4f6',
    padding: '2rem',
    borderRadius: '15px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    width: '100%',
    maxWidth: '360px'
  },
  title: {
    textAlign: 'center',
    marginBottom: '1rem',
    fontSize: '1.6rem'
  },
  form: {
    width: '100%'
  },
  floatingGroup: {
    position: 'relative',
    width: '100%',
    marginBottom: '1.5rem'
  },
  floatingInput: {
    width: '100%',
    padding: '1rem 0.8rem 0.5rem',
    border: 'none',
    borderBottom: '2px solid #9ca3af',
    backgroundColor: 'transparent',
    color: '#f9fafb',
    fontSize: '1rem',
    outline: 'none'
  },
  floatingLabel: {
    position: 'absolute',
    left: '10px',
    top: '14px',
    color: '#9ca3af',
    fontSize: '1rem',
    pointerEvents: 'none',
    transition: 'all 0.2s ease'
  },
  toggleBtn: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: '#60a5fa',
    cursor: 'pointer',
    fontSize: '1rem'
  },
  button: {
    width: '100%',
    padding: '0.9rem',
    backgroundColor: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer'
  },
  error: {
    color: '#f87171',
    textAlign: 'center',
    marginBottom: '1rem'
  },
  footerText: {
    textAlign: 'center',
    marginTop: '1rem',
    fontSize: '0.95rem',
    color: '#d1d5db'
  }
};

export default Signup;
