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

  const navigate = useNavigate();

  // ✅ Redirect if no valid oobCode is found (direct access to reset page not allowed)
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

      // ✅ Force redirect to login, replacing history so back button can't return here
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
          <div className="floating-group">
            <input
              type="password"
              placeholder=" "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="floating-input"
            />
            <label className="floating-label">New Password</label>
          </div>

          <div className="floating-group">
            <input
              type="password"
              placeholder=" "
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="floating-input"
            />
            <label className="floating-label">Confirm Password</label>
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
