import React from "react";
import { useNavigate } from "react-router-dom";
import "./styles/Terms.css";
import Logo2 from "../assets/Logo.png";
import Back from "../assets/back.png";


const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="terms-container">
    
      {/* 🔙 Back Button */}
        <button
        onClick={() => navigate(-1)}
        style={{
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer"
        }}
        >
        <img
            src={Back}
            alt="Back icon"
            style={{ width: "40px", height: "40px" }}
        />
        </button>


      <h1>
        <img src={Logo2} alt="logo" className="logo-main" style={{ width: "35px", height: "35px", marginBottom:'-10px' }} />EXO APP Terms & Conditions, Privacy Policy & Disclaimer
      </h1>

      <p className="updated">
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <section>
        <h3>1. Introduction</h3>
        <p>
          Welcome to <strong>NEXO App</strong>. By accessing, registering, or
          using this application, you agree to comply with these Terms &
          Conditions, Privacy Policy, and Disclaimer. If you do not agree, please
          do not use this app.
        </p>
        <p>
          NEXO App operates under the laws of the Islamic Republic of Pakistan,
          including the <strong>Prevention of Electronic Crimes Act (PECA)
          2016</strong>.
        </p>
      </section>

      <section>
        <h3>2. Eligibility</h3>
        <ul>
          <li>You must be 18 years or older</li>
          <li>You are legally allowed to use digital platforms</li>
          <li>All information provided is true and accurate</li>
        </ul>
      </section>

      <section className="warning">
        <h3>⚠️ Disclaimer & Risk Acknowledgment</h3>
        <p>
          By signing up, you acknowledge that all activities within the NEXO App,
          including deposits, withdrawals, referrals, and pool participation,
          are performed voluntarily and at your own risk.
        </p>
        <p>
          You accept full responsibility for any profits or losses. NEXO App and
          its operators hold no liability for any financial outcomes.
        </p>
      </section>

      <section>
        <h3>3. No Financial Advice</h3>
        <p>
          NEXO App does not provide financial, investment, legal, or tax advice.
          All participation is done at the user's discretion.
        </p>
      </section>

      <section>
        <h3>4. Limitation of Liability</h3>
        <p>
          NEXO App, its owners, and operators shall not be responsible for
          financial loss, technical issues, delays, or third-party service
          failures.
        </p>
      </section>

      <section>
        <h3>5. Privacy Policy</h3>
        <p>
          We may collect personal information such as name, email, wallet
          address, transaction history, and uploaded files. This data is used
          solely to operate and improve the app.
        </p>
        <p>
          We do not sell or share personal data with unauthorized third parties.
        </p>
      </section>

      <section>
        <h3>6. Account Security</h3>
        <p>
          You are responsible for keeping your account credentials secure. Any
          activity under your account is your responsibility.
        </p>
      </section>

      <section>
        <h3>7. Account Termination</h3>
        <p>
          We reserve the right to suspend or terminate accounts involved in
          fraud, abuse, or illegal activity.
        </p>
      </section>

      <section>
        <h3>8. Governing Law</h3>
        <p>
          These terms are governed by the laws of Pakistan, including PECA 2016.
        </p>
      </section>
    </div>
  );
};

export default Terms;
