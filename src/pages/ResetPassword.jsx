import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { confirmPasswordReset } from "firebase/auth";
import { auth } from "../firebase";
import Logo from "../assets/Text.png";
import Logo2 from "../assets/Logo.png";
import "./styles/forms.css";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // 👁️ states for showing/hiding passwords
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();

  // ✅ Redirect if no valid oobCode is found
  useEffect(() => {
    if (!oobCode) {
      navigate("/login", { replace: true });
    }
  }, [oobCode, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      await confirmPasswordReset(auth, oobCode, password);
      setSuccess("Password has been reset successfully!");

      // ✅ Redirect to login and clear history
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch (err) {
      console.error("❌ Reset error:", err);
      setError("Failed to reset password. The link may be invalid or expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <div className="form-overlay"></div>
      <div className="form-card">
        <h2 className="form-title">
          <img src={Logo2} alt="logo" className="logo-main" />
          Reset Password
          <img src={Logo} alt="text" className="logo-text" />
        </h2>

        {error && <p className="form-error">{error}</p>}
        {success && <p className="form-success">{success}</p>}

        <form onSubmit={handleSubmit} className="form-box">
          {/* New Password */}
          <div className="floating-group password-group">
            <input
              type={showPassword ? "text" : "password"}
              placeholder=" "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="floating-input"
            />
            <label className="floating-label">New Password</label>
            <button
              type="button"
              className="eye-btn"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          {/* Confirm Password */}
          <div className="floating-group password-group">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder=" "
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="floating-input"
            />
            <label className="floating-label">Confirm Password</label>
            <button
              type="button"
              className="eye-btn"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
            >
              {showConfirmPassword ? "🙈" : "👁️"}
            </button>
          </div>

          <button type="submit" className="form-button" disabled={loading}>
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
