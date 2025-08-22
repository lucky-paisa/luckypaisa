import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../assets/Text.png';
import Logo2 from '../assets/Logo.png';
import './styles/forms.css';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charIndex, deleting, phraseIndex]);

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

    try {
      // Firebase Auth login
      const userCred = await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const user = userCred.user;

      // Step 1: Check roles/{uid} to see if admin
      const roleRef = doc(db, "roles", user.uid);
      const roleSnap = await getDoc(roleRef);

      if (roleSnap.exists() && roleSnap.data().isAdmin) {
        // Admin login
        const adminData = {
          uid: user.uid,
          email: user.email,
          name: "Lucky Paisa Admin",
          isAdmin: true
        };
        login(adminData);
        setSuccess("Admin login successful!");
        setTimeout(() => navigate("/admin"), 1200);
        return;
      }

      // Step 2: If not admin, fetch from users collection
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", formData.email));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        login({ uid: user.uid, ...userData, isAdmin: false });
        setSuccess("Login successful!");
        setTimeout(() => navigate("/home"), 1200);
      } else {
        setError("User profile not found.");
      }
    } catch (err) {
      console.error("❌ Login error:", err);
      setError("Invalid email or password.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!modalEmail) return;
    setForgotLoading(true);
    setError('');
    setSuccess('');

    try {
      await sendPasswordResetEmail(auth, modalEmail);
      setSuccess('Password reset link sent to email. Please check your inbox or SPAM folder.');
      setShowModal(false);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email.');
      } else {
        setError('Failed to send reset email. Please try again.');
      }
      console.error(err);
    }

    setForgotLoading(false);
  };

  return (
    <div className="form-container">
      <div className="form-overlay"></div>

      <div className="form-card">
        <h2 className="form-title">
          <img src={Logo2} alt="logo" className="logo-main" />
          Login To
          <img src={Logo} alt="text logo" className="logo-text" />
        </h2>

        <div className="typing-wrapper">
          <h1 className="typing-static">
            <span className="typing-dynamic">{typingText}</span>
            <span className="cursor">|</span>
          </h1>
        </div>

        {error && <p className="form-error">{error}</p>}
        {success && <p className="form-success">{success}</p>}

        <div className="form-wrapper">
          <form onSubmit={handleSubmit} className="form-box">
            <div className="floating-group">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                required
                placeholder=" "
                className="floating-input"
              />
              {!(formData.email || emailFocused) && (
                <label className="floating-label">Email</label>
              )}
            </div>

            <div className="floating-group">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                required
                placeholder=" "
                className="floating-input"
              />
              {!(formData.password || passwordFocused) && (
                <label className="floating-label">Password</label>
              )}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="toggle-btn"
              >
                {showPassword ? '👁' : '⌣'}
              </button>
            </div>

            <button type="submit" className="form-button" disabled={loginLoading}>
              {loginLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className="footer-text">
            <a style={{ color: '#60a5fa', cursor: 'pointer' }} onClick={() => setShowModal(true)}> Forgot Password? </a>
          </p>

          <p className="footer-text">
            Don’t have an account?{' '}
            <a href="/signup?showDisclaimer=true" style={{ color: '#60a5fa' }}>Sign Up</a>
          </p>
        </div>
      </div>

      <br />

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="modal-title">Forgot Password</h3>
            <input
              type="email"
              placeholder="Enter your registered email"
              value={modalEmail}
              onChange={(e) => setModalEmail(e.target.value)}
              className="modal-input"
            />
            <button onClick={handleForgotPassword} className="modal-button">
              {forgotLoading ? 'Sending...' : 'Send Password'}
            </button>
            <button onClick={() => setShowModal(false)} className="modal-close">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
