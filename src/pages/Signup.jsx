import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import Logo from '../assets/Text.png';
import Logo2 from '../assets/Logo.png';
import './styles/forms.css';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const showDisclaimerInitially = searchParams.get("showDisclaimer") === "true" || searchParams.has("ref");
  const [showDisclaimer, setShowDisclaimer] = useState(showDisclaimerInitially);


  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!accepted) {
      return setError("You must accept the disclaimer to continue.");
    }

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
        referenceBy: referralId ? referralId : "SELF",
        acceptedDisclaimer: true,
        acceptedAt: new Date(),
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
    <div className="form-container">
      <div className="form-overlay"></div>

      {/* Disclaimer Modal */}
      {showDisclaimer && (
        <div className="modalOverlay">
          <div className="modalBox">
            {/* Close Button */}
            <button
              className="modalClose"
              onClick={() => navigate('/login')}
            >
              ✖
            </button>

            <h2>⚠️Disclaimer & Terms</h2>
            <div className="modalContent">
              <p>
                By signing up, you acknowledge that all activities within <span style={{color:'#ffc734'}}>
                VEON App </span>, including deposits, withdrawals, pool participation, and
                Lucky Draw entries, are carried out at your own choice and
                responsibility. You confirm that you are acting voluntarily, at
                your own risk, and accept full responsibility for any profits or
                losses. The app and its operators hold no liability for any
                financial consequences.
              </p>
              <p>
                By checking the box below, you confirm that you have read,
                understood, and agreed to this disclaimer, as well as the <span style={{color:'#ffc734'}}>
                Terms & Conditions</span>, in compliance with Pakistani law including PECA
                2016.
              </p>

              <label style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                I have read and accept the Disclaimer & Terms
              </label>

              <button
                onClick={() => setShowDisclaimer(false)}
                disabled={!accepted}
                style={{
                  marginTop: "15px",
                  padding: "10px 15px",
                  borderRadius: "8px",
                  background: accepted ? "#4CAF50" : "#aaa",
                  color: "#fff",
                  fontWeight: "bold",
                  cursor: accepted ? "pointer" : "not-allowed",
                }}
              >
                Continue to Signup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signup Card */}
      <div className="form-card" style={{ filter: showDisclaimer ? "blur(4px)" : "none" }}>
        <h2 className="form-title">
          <img src={Logo2} alt="logo" className="logo-main" />
          Create Your Account
          <img src={Logo} alt="text" className="logo-text" />
        </h2>

        {error && <p className="form-error">{error}</p>}

        <form onSubmit={handleSubmit} className="form-box">
          {/* Name */}
          <div className="floating-group">
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder=" "
              className="floating-input"
              disabled={showDisclaimer}
            />
            <label className="floating-label">Full Name</label>
          </div>

          {/* Email */}
          <div className="floating-group">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder=" "
              className="floating-input"
              disabled={showDisclaimer}
            />
            <label className="floating-label">Email</label>
          </div>

          {/* Phone */}
          <div className="floating-group">
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              placeholder=" "
              className="floating-input"
              disabled={showDisclaimer}
            />
            <label className="floating-label">Phone Number</label>
          </div>

          {/* Password */}
          <div className="floating-group">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder=" "
              className="floating-input"
              disabled={showDisclaimer}
            />
            <label className="floating-label">Password</label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="toggle-btn"
            >
              {showPassword ? '👁' : '⌣'}
            </button>
          </div>

          {/* Confirm Password */}
          <div className="floating-group">
            <input
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder=" "
              className="floating-input"
              disabled={showDisclaimer}
            />
            <label className="floating-label">Confirm Password</label>
          </div>

          <button type="submit" className="form-button" disabled={loading || showDisclaimer}>
            {loading ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>

        <p className="footer-text">
          Already have an account?{' '}
          <a href="/login" style={{ color: '#60a5fa' }}>Login</a>
        </p>
      </div>
    </div>
  );
};

export default Signup;
