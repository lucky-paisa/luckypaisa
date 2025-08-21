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
  const [focused, setFocused] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        referenceBy: referralId ? referralId : "SELF",
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
      <div className="form-card">
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
              onFocus={() => setFocused({ ...focused, name: true })}
              onBlur={() => setFocused({ ...focused, name: false })}
              required
              placeholder=" "
              className="floating-input"
            />
            {!(formData.name || focused.name) && (
              <label className="floating-label">Full Name</label>
            )}
          </div>

          {/* Email */}
          <div className="floating-group">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              onFocus={() => setFocused({ ...focused, email: true })}
              onBlur={() => setFocused({ ...focused, email: false })}
              required
              placeholder=" "
              className="floating-input"
            />
            {!(formData.email || focused.email) && (
              <label className="floating-label">Email</label>
            )}
          </div>

          {/* Phone */}
          <div className="floating-group">
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              onFocus={() => setFocused({ ...focused, phone: true })}
              onBlur={() => setFocused({ ...focused, phone: false })}
              required
              placeholder=" "
              className="floating-input"
            />
            {!(formData.phone || focused.phone) && (
              <label className="floating-label">Phone Number</label>
            )}
          </div>

          {/* Password */}
          <div className="floating-group">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleChange}
              onFocus={() => setFocused({ ...focused, password: true })}
              onBlur={() => setFocused({ ...focused, password: false })}
              required
              placeholder=" "
              className="floating-input"
            />
            {!(formData.password || focused.password) && (
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

          {/* Confirm Password */}
          <div className="floating-group">
            <input
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              onFocus={() => setFocused({ ...focused, confirmPassword: true })}
              onBlur={() => setFocused({ ...focused, confirmPassword: false })}
              required
              placeholder=" "
              className="floating-input"
            />
            {!(formData.confirmPassword || focused.confirmPassword) && (
              <label className="floating-label">Confirm Password</label>
            )}
          </div>

          <button type="submit" className="form-button" disabled={loading}>
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
