import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from "firebase/auth";


const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalEmail, setModalEmail] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const [typingText, setTypingText] = useState('');
  const [charIndex, setCharIndex] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const phrases = [
    'great earnings',
    'big profits',
    'better investment',
    'secure future',
    'smart returns'
  ];

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Login | Lucky Paisa';
  }, []);

  // Typing animation effect
  useEffect(() => {
    const currentPhrase = phrases[phraseIndex];
    const timer = setTimeout(() => {
      if (!deleting) {
        setTypingText(currentPhrase.slice(0, charIndex + 1));
        setCharIndex((prev) => prev + 1);
        if (charIndex === currentPhrase.length) {
          setDeleting(true);
        }
      } else {
        setTypingText(currentPhrase.slice(0, charIndex - 1));
        setCharIndex((prev) => prev - 1);
        if (charIndex === 0) {
          setDeleting(false);
          setPhraseIndex((prev) => (prev + 1) % phrases.length);
        }
      }
    }, deleting ? 100 : 100);

    return () => clearTimeout(timer);
  }, [charIndex, deleting, phraseIndex, phrases]);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');
  setSuccess('');
  setLoginLoading(true);

  console.clear();
  console.log("=== LOGIN STARTED ===");
  console.log("Email entered:", formData.email);

  // Admin check
  if (
    formData.email === 'feedback.luckypaisa@gmail.com' &&
    formData.password === 'LuckyPaisaAdmin786'
  ) {
    console.log("Admin login detected");
    localStorage.setItem('isAdmin', 'true');
    setSuccess('Admin login successful!');
    setTimeout(() => navigate('/admin'), 1200);
    setLoginLoading(false);
    return;
  }

  try {
    console.log("Attempting Firebase Auth sign-in...");
    const userCred = await signInWithEmailAndPassword(
      auth,
      formData.email,
      formData.password
    );
    const user = userCred.user;
    console.log("Auth success:", user.uid, user.email);

    console.log("Fetching Firestore user document by UID...");
    const userDocRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      console.log("Firestore user document found:", userSnap.data());
      const userData = userSnap.data();
      login({ uid: user.uid, ...userData });
      localStorage.setItem('isAdmin', 'false');
      setSuccess('Login successful!');
      setTimeout(() => navigate('/home'), 1200);
    } else {
      console.warn("No Firestore document found for UID:", user.uid);
      setError('User data not found in Firestore.');
    }

  } catch (err) {
    console.error("Firebase Auth error:", err.code, err.message);
    setError(`Login failed: ${err.message}`);
  } finally {
    console.log("=== LOGIN ENDED ===");
    setLoginLoading(false);
  }
};


  const handleForgotPassword = async () => {
  if (!modalEmail) return;
  setForgotLoading(true);
  setError('');
  try {
    await sendPasswordResetEmail(auth, modalEmail);
    setSuccess('Password reset email sent. Please check your inbox (and spam folder).');
    setShowModal(false);
  } catch (err) {
    console.error("Error sending reset email:", err);
    if (err.code === 'auth/user-not-found') {
      setError('Account with this email does not exist.');
    } else {
      setError('Failed to send reset email.');
    }
  }
  setForgotLoading(false);
};

  return (
    <div style={styles.container}>
      <div style={styles.overlay}></div>

      {/* Typing Heading */}
      <div style={styles.typingWrapper}>
        <h1 style={styles.typingStatic}>Welcome to Lucky Paisa
          <br/>
          <span style={styles.typingDynamic}>{typingText}</span>
          <span style={styles.cursor}>|</span>
        </h1>
      </div>

      <div style={styles.card} className="fade-in">
        <h2 style={styles.title}>Login to Your Account</h2>
        {error && <p style={styles.error}>{error}</p>}
        {success && <p style={styles.success}>{success}</p>}
        <div style={styles.formWrapper}>
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.floatingGroup}>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                required
                style={styles.floatingInput}
              />
              {!(formData.email || emailFocused) && (
                <label style={styles.floatingLabel}>Email</label>
              )}
            </div>

            <div style={styles.floatingGroup}>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                required
                style={styles.floatingInput}
              />
              {!(formData.password || passwordFocused) && (
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

            <button type="submit" style={styles.button} disabled={loginLoading}>
              {loginLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <button
            style={styles.forgotBtn}
            onClick={() => setShowModal(true)}
            disabled={forgotLoading}
          >
            {forgotLoading ? 'Sending...' : 'Forgot Password?'}
          </button>

          <p style={styles.footerText}>
            Don’t have an account?{' '}
            <a href="/signup" style={{ color: '#60a5fa' }}>Sign Up</a>
          </p>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>Forgot Password</h3>
            <input
              type="email"
              placeholder="Enter your registered email"
              value={modalEmail}
              onChange={(e) => setModalEmail(e.target.value)}
              style={styles.modalInput}
            />
            <button onClick={handleForgotPassword} style={styles.modalButton}>
              {forgotLoading ? 'Sending...' : 'Send Password'}
            </button>
            <button onClick={() => setShowModal(false)} style={styles.modalClose}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Embedded CSS for fade effect */}
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
    flexDirection: 'column',
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
  typingWrapper: {
    zIndex: 2,
    marginBottom: '1rem',
    textAlign: 'center'
  },
  typingStatic: {
    fontSize: '1.4rem',
    color: '#f9fafb',
    fontWeight: 'bold'
  },
  typingDynamic: {
    color: '#4caf50'
  },
  cursor: {
    display: 'inline-block',
    color: '#38bdf8',
    animation: 'blink 1s step-start infinite'
  },
  card: {
    position: 'relative',
    zIndex: 2,
    background: '#1f2937',
    color: '#f3f4f6',
    padding: '2rem',
    borderRadius: '15px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    width: '85%',
    maxWidth: '360px'
  },
  title: {
    textAlign: 'center',
    marginBottom: '1rem',
    fontSize: '1.6rem'
  },
  formWrapper: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
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
  forgotBtn: {
    marginTop: '1rem',
    width: '100%',
    padding: '0.8rem',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.95rem'
  },
  error: {
    color: '#f87171',
    textAlign: 'center',
    marginBottom: '1rem'
  },
  success: {
    color: '#34d399',
    textAlign: 'center',
    marginBottom: '1rem'
  },
  footerText: {
    textAlign: 'center',
    marginTop: '1rem',
    fontSize: '0.95rem',
    color: '#d1d5db'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999
  },
  modal: {
    background: '#1f2937',
    padding: '2rem',
    borderRadius: '10px',
    boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
    width: '90%',
    maxWidth: '400px',
    color: '#f3f4f6',
    textAlign: 'center'
  },
  modalTitle: {
    marginBottom: '1rem',
    fontSize: '1.3rem'
  },
  modalInput: {
    width: '100%',
    padding: '0.8rem',
    marginBottom: '1rem',
    borderRadius: '8px',
    border: '1px solid #ccc',
    fontSize: '1rem'
  },
  modalButton: {
    width: '100%',
    padding: '0.8rem',
    backgroundColor: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    marginBottom: '0.5rem',
    cursor: 'pointer'
  },
  modalClose: {
    backgroundColor: '#9ca3af',
    color: '#1f2937',
    border: 'none',
    padding: '0.6rem 1.2rem',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.9rem'
  }
};

export default Login;
