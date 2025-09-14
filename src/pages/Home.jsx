import './styles/Home.css';
import Logo from '../assets/Text2.png';
import Logo2 from '../assets/Logo.png';
import Icon from "../assets/P Icon.png";
import L_Icon from "../assets/L Icon.png";
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';  
import { sendPasswordResetEmail } from "firebase/auth";
import { useMemo } from "react";
import {
  doc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  onSnapshot,
  getDoc, 
  setDoc,
  arrayUnion,
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { auth } from "../firebase";

const Home = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(0);
  const [purchases, setPurchases] = useState([]);
  const [withdrawalAddress, setWithdrawalAddress] = useState('');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingPlanIds, setPendingPlanIds] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [showPurchases, setShowPurchases] = useState(false);
  const [animatedText, setAnimatedText] = useState('');
  const [userData, setUserData] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [currentAnnouncementIndex, setCurrentAnnouncementIndex] = useState(0);
  const [overrideAnnouncement, setOverrideAnnouncement] = useState(null);
  const announcementIntervalRef = useRef(null); // ref for rotation interval
  const announcementTimeoutRef = useRef(null); // ref for override timeout
  const [alertModal, setAlertModal] = useState({ show: false,  message: '', isAnnouncement: false, timestamp: null });
  const [alertModalConfirm, setAlertModalConfirm] = useState({ show: false,  message: '', isAnnouncement: false, timestamp: null });
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositScreenshot, setDepositScreenshot] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [withdrawHistory, setWithdrawHistory] = useState([]);
  const [depositHistory, setDepositHistory] = useState([]);
  const [teamRewardsHistory, setTeamRewardsHistory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [planWins, setPlanWins] = useState([]);
  const [poolWins, setPoolWins] = useState([]);
  const [purchasedPools, setPurchasedPools] = useState([]);
  const [showPools, setShowPools] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [lastClaims, setLastClaims] = useState({});
  const [userLoaded, setUserLoaded] = useState(false);
  const [poolWallet, setPoolWallet] = useState(0); 
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [exchangeAmount, setExchangeAmount] = useState("");
  const [isExchanging, setIsExchanging] = useState(false);
  const [teamCount, setTeamCount] = useState(0);
  const [lastTeamClaim, setLastTeamClaim] = useState(null);
  const [loadingTeamReward, setLoadingTeamReward] = useState(true);

// 📌 Combine all history into one array
const combinedHistory = useMemo(() => {
  const deposits = (depositHistory || []).map(item => ({
    type: "deposit",
    amount: item.amount,
    status: item.status,
    time: new Date(item.time).getTime()
  }));

  const withdrawals = (withdrawHistory || []).map(item => ({
    type: "withdraw",
    amount: item.amount,
    status: item.status,
    time: new Date(item.time).getTime()
  }));

  const wins = (planWins || []).map(item => ({
    type: "planWin",
    amount: item.amount,
    planName: item.planName,
    time: new Date(item.time).getTime()
  }));

  const teamRewards = (teamRewardsHistory || []).map(item => ({
    type: "teamReward",
    amount: item.amount,
    teamCount: item.teamCount,
    time: new Date(item.time).getTime()
  }));

  // merge and sort latest → oldest
  return [...deposits, ...withdrawals, ...wins, ...teamRewards].sort(
    (a, b) => b.time - a.time
  );
}, [depositHistory, withdrawHistory, planWins, teamRewardsHistory]);


useEffect(() => {
  if (!user || !user.uid) return;

  const userRef = doc(db, 'users', user.uid);
  let previousAnnouncement = "";
  const lastSeenKey = `lastSeenAnnouncement_${user.uid}`;

  const unsubscribe = onSnapshot(userRef, (docSnap) => {
    if (!docSnap.exists()) return;
    const data = docSnap.data();

    // ✅ Always keep purchases synced with DB (admin deletions reflected)
    const updatedPurchases = data.purchases || [];
    setPurchases(updatedPurchases);
    // ✅ Keep transactions in sync (real-time)
    setTransactions(data.transactions || []);
    setDepositHistory(data.depositHistory || []);
    setWithdrawHistory(data.withdrawHistory || []);
    setTeamRewardsHistory(data.teamRewardsHistory || []);
    setPoolWins(data.poolWins || []);
    setPlanWins(data.planWins || []);

    // ✅ Keep purchased pools in sync
    const purchasedPoolIds = (updatedPurchases || [])
      .filter(p => String(p.planId).startsWith("pool_"))
      .map(p => Number(p.planId.split("_")[1]));
    setPurchasedPools(purchasedPoolIds);  

    // ✅ Auto-create & sync teamCount from referralBonusHistory
      const referralHistory = data.referralBonusHistory || [];
      const referralCount = referralHistory.length;

      if (!data.teamCount || data.teamCount !== referralCount) {
        updateDoc(userRef, { teamCount: referralCount }).catch(err =>
          console.error("Failed to update teamCount:", err)
        );
      }

      // keep local state in sync
      setTeamCount(referralCount);
      setLastTeamClaim(data.lastTeamClaim || null);
      setLoadingTeamReward(false);

    // keep user fields in state
    setUserData(data);
    setWallet(data.wallet || 0);
    setPoolWallet(data.poolWallet || 0);
    setLastTeamClaim(data.lastTeamClaim || null);
    setLoadingTeamReward(false);

    // ✅ Load pool claim times into state for countdown
    if (data.poolClaims) {
      setLastClaims(data.poolClaims);
    }
    setWithdrawalAddress(data.walletAddress || '');

    // ALERT-only messages (approve/drop)
    if (data.alertMessage) {
      const lastAlertKey = `lastAlert_${user.uid}`;
      const alertTs = data.alertTimestamp
        ? data.alertTimestamp.toDate().getTime().toString()
        : data.alertMessage;
      const alreadySeen = localStorage.getItem(lastAlertKey) === alertTs;

      if (!alreadySeen) {
        setAlertModal({
          show: true,
          message: data.alertMessage,
          isAnnouncement: false,
          timestamp: alertTs
        });
      }
    }

    // ANNOUNCEMENTS (only silver, gold, diamond winners from last 24h)
    if (Array.isArray(data.winnerAnnouncements) && data.winnerAnnouncements.length > 0) {
      const now = Date.now();
      const twentyFour = 24 * 60 * 60 * 1000;

      // Filter to only last 24h & only silver/gold/diamond plans
      const filtered = data.winnerAnnouncements.filter(w => {
        const ts = w.timestamp?.toDate?.()?.getTime?.() || 0;
        const msg = (w.message || "").toLowerCase();
        return (
          now - ts <= twentyFour &&
          (msg.includes("silver plan") || msg.includes("gold plan") || msg.includes("diamond plan"))
        );
      });

      if (filtered.length > 0) {
        // Convert to messages only
        const winnerMessages = filtered.map(w => w.message);

        // Remove duplicates
        const uniqueMessages = [...new Set(winnerMessages)];

        setAnnouncements(uniqueMessages);

        // If user hasn't seen the latest one, show modal alert
        const latest = filtered.sort((a, b) => 
          (b.timestamp?.toDate?.()?.getTime?.() || 0) -
          (a.timestamp?.toDate?.()?.getTime?.() || 0)
        )[0];

        const ackKey = `ackAnnouncement_${user.uid}`;
        const ackValue = localStorage.getItem(ackKey);
        const latestTs = latest.timestamp?.toDate?.()?.getTime?.().toString();

        if (ackValue !== latestTs) {
          setAlertModal({
            show: true,
            message: latest.message,
            isAnnouncement: true,
            timestamp: latestTs
          });
        }
      } else {
        setAnnouncements([]);
        showTemporaryAnnouncement('📣 No current winner announcements.');
      }
    } else {
      setAnnouncements([]);
      showTemporaryAnnouncement('📣 No current winner announcements.');
    }
  setUserLoaded(true);
  });


  // ✅ Real-time listener for approved plans in 'purchases' collection
const purchasesRef = query(
  collection(db, 'purchases'),
  where('uid', '==', user.uid)
);

const unsubscribePurchases = onSnapshot(purchasesRef, async (querySnapshot) => {
  const approvedPlans = [];
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (!purchases.some(p => p.planId === data.planId)) {
      approvedPlans.push({
        planId: data.planId,
        status: 'approved',
        purchasedAt: data.approvedAt || Date.now(),
        expiresAt: data.expiresAt || null // 🆕 keep expiry if admin added it
      });

    }
  });

  if (approvedPlans.length > 0) {
    // ✅ Add to local state
    const updatedPurchases = [...purchases, ...approvedPlans];
    setPurchases(updatedPurchases);

    // ✅ Update user's document (optional but recommended)
    await updateDoc(doc(db, 'users', user.uid), {
      purchases: updatedPurchases,
    });

    // ✅ Remove from pendingPlanIds
    const newPending = pendingPlanIds.filter(id => !approvedPlans.find(p => p.planId === id));    
    setPendingPlanIds(newPending);

    // ✅ Show announcement
    const planNames = approvedPlans.map(p => planNameMap[p.planId] || `${formatPlanName(p.planId)}`).join(', ');
     showToast(`✅ Your ${planNames} has been approved!`, 'success');

  }
});

  // Fetch pending plans once (not real-time)
  const fetchPendingPlans = async () => {
    const q = query(collection(db, 'pendingPlans'), where('uid', '==', user.uid));
    const querySnapshot = await getDocs(q);
    const pending = [];

    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.status === 'pending') {
        pending.push(data.planId);
      }
    });

    setPendingPlanIds(pending);
  };

  fetchPendingPlans();


    // ✅ Listen for global admin announcements (last 24h only)
  const globalRef = collection(db, "globalAnnouncements");
  const unsubGlobal = onSnapshot(globalRef, (snap) => {
    const now = Date.now();
    const twentyFour = 24 * 60 * 60 * 1000;

    const recent = snap.docs
      .map(d => d.data())
      .filter(d => now - d.timestamp?.toDate()?.getTime() <= twentyFour)
      .map(d => d.message);

    if (recent.length > 0) {
      setAnnouncements(prev => [...new Set([...prev, ...recent])]);
    }
  });


  return () => {
  unsubscribe(); // user listener
  unsubscribePurchases(); // approved plans listener
  if (unsubGlobal) unsubGlobal();
  };
// ✅ cleanup listener
}, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Show a temporary announcement for 10 seconds (pauses rotation while shown)
  const showTemporaryAnnouncement = (message) => {
    // clear any existing override timeout
    if (announcementTimeoutRef.current) {
      clearTimeout(announcementTimeoutRef.current);
      announcementTimeoutRef.current = null;
    }

    setOverrideAnnouncement(message);

    // after 10s, clear override and resume rotation
    announcementTimeoutRef.current = setTimeout(() => {
      setOverrideAnnouncement(null);
      announcementTimeoutRef.current = null;
    }, 10000);
  };

  useEffect(() => {
    return () => {
      if (announcementIntervalRef.current) {
        clearInterval(announcementIntervalRef.current);
      }
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }
    };
  }, []);


useEffect(() => {
  const messages = ['Invest', 'Earn', 'Reward'];
  let index = 0;
  let charIndex = 0;
  let currentText = '';
  let isDeleting = false;

  const type = () => {
    const fullText = messages[index];
    if (isDeleting) {
      currentText = fullText.substring(0, charIndex--);
    } else {
      currentText = fullText.substring(0, charIndex++);
    }

    setAnimatedText(currentText);

    if (!isDeleting && charIndex === fullText.length) {
      setTimeout(() => isDeleting = true, 1000);
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      index = (index + 1) % messages.length;
    }

    setTimeout(type, 100);
  };

  type();
}, []);

  const handleWithdrawRequest = async () => {
    if (!withdrawAmount || withdrawAmount <= 0) {
      showToast("Please enter a valid amount", "error");
      return;
    }

    if (withdrawAmount > userData.wallet) {
      showToast("Insufficient balance", "error");
      return;
    }

    try {
      setLoading(true);
      const oldBalance = userData.wallet;
      const newBalance = oldBalance - withdrawAmount;

      // Create withdraw request document
      await addDoc(collection(db, "withdrawRequests"), {
        uid: user.uid,
        userName: userData.name || "Unknown",
        oldBalance,
        amount: withdrawAmount,
        newBalance,
        walletAddress: userData.walletAddress || "",
        status: "pending",
        createdAt: serverTimestamp()
      });

      // Update wallet immediately
      // 🆕 Push to user's withdrawHistory immediately
      await updateDoc(doc(db, 'users', user.uid), {
        wallet: newBalance,
          withdrawHistory: arrayUnion({
          amount: withdrawAmount,
          status: 'Pending',
          time: new Date().toISOString()
        })
      });

      // Update local state
      setUserData(prev => ({ ...prev, wallet: newBalance }));
      setWithdrawAmount(""); // reset input
      setWithdrawAmount(""); // reset input
      setShowWithdrawModal(false);
      setAlertModal({
        show: true,
        message: "✅ Your withdrawal request has been sent and will be approved within 24 hours.",
        isAnnouncement: false,
        timestamp: Date.now().toString()
      });

    } catch (error) {
      console.error("Error sending withdraw request:", error);
      showToast("Failed to send request", "error");
    }
    finally{
      setLoading(false);
    }
  };

 const handleBuyWithWallet = async () => {
  if (!selectedPlan || poolWallet < selectedPlan.price) {
    showToast("❌ Not enough Pool Wallet balance to buy this plan", "error");
    return;
  }

  if (purchases.some(p => p.planId === selectedPlan.id)) {
    showToast(`❌ You already purchased ${planNameMap[selectedPlan.id]}.`, "error");
    return;
  }

  setLoading(true);

  const updatedPoolWallet = poolWallet - selectedPlan.price;
  const luckyDrawEnd = Date.now() + (selectedPlan.days * 24 * 60 * 60 * 1000);

  const newPurchase = {
    uid: user.uid,
    userName: user.name || '',
    email: user.email || '',
    planId: selectedPlan.id,
    price: selectedPlan.price,
    days: selectedPlan.days,
    reward: selectedPlan.reward,
    approvedAt: serverTimestamp(),
    status: 'approved',
    expiresAt: luckyDrawEnd
  };

  const updatedPurchases = [
    ...purchases,
    { planId: selectedPlan.id, status: 'approved', purchasedAt: Date.now() },
  ];

  await updateDoc(doc(db, 'users', user.uid), {
    poolWallet: updatedPoolWallet,   // ✅ Deduct from Pool Wallet
    purchases: updatedPurchases
  });

  await addDoc(collection(db, 'purchases'), newPurchase);

  setPoolWallet(updatedPoolWallet);
  setPurchases(updatedPurchases);

  setShowBuyModal(false);
  setSelectedPlan(null);
  setLoading(false);

  showToast(`✅ You successfully joined ${planNameMap[selectedPlan.id]}`, "success");
};

  const plans = [
    { id: 1, price: 1, days: 10, reward: 10 },
    { id: 2, price: 5, days: 20, reward: 50 },
    { id: 3, price: 10, days: 30, reward: 100 },
  ];

  const [toasts, setToasts] = useState([]);

  // show toast function
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);

    // auto remove after 4s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

// Add inside Home component:
const [planCountdowns, setPlanCountdowns] = useState({});

useEffect(() => {
  const unsubscribers = [];

  ["plan_1", "plan_2", "plan_3"].forEach((planKey) => {
    const planRef = doc(db, "planSettings", planKey);

    const unsubscribe = onSnapshot(planRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!data.startTime || !data.duration) return;

        const endTime =
          data.startTime.toDate().getTime() +
          parseInt(data.duration) * 24 * 60 * 60 * 1000;

        const updateCountdown = () => {
          const now = new Date().getTime();
          const distance = endTime - now;

          if (distance <= 0) {
            setPlanCountdowns((prev) => ({
              ...prev,
              [planKey]: "00d 00h 00m 00s",
            }));
            return;
          }

          const days = Math.floor(distance / (1000 * 60 * 60 * 24));
          const hours = Math.floor(
            (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
          );
          const minutes = Math.floor(
            (distance % (1000 * 60 * 60)) / (1000 * 60)
          );
          const seconds = Math.floor((distance % (1000 * 60)) / 1000);

          setPlanCountdowns((prev) => ({
            ...prev,
            [planKey]: `${days}d ${hours}h ${minutes}m ${seconds}s`,
          }));
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        unsubscribers.push(() => clearInterval(interval));
      }
    });

    unsubscribers.push(unsubscribe);
  });

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
  }, []);

  useEffect(() => {
    // if override is showing, pause rotation
    if (overrideAnnouncement) {
      if (announcementIntervalRef.current) {
        clearInterval(announcementIntervalRef.current);
        announcementIntervalRef.current = null;
      }
      return;
    }

    // start rotation if many announcements exist
    if ((announcements?.length || 0) > 0) {
      if (announcementIntervalRef.current) {
        clearInterval(announcementIntervalRef.current);
      }
      announcementIntervalRef.current = setInterval(() => {
        setCurrentAnnouncementIndex(prev => (prev + 1) % announcements.length);
      }, 10000);
    }

    return () => {
      if (announcementIntervalRef.current) {
        clearInterval(announcementIntervalRef.current);
        announcementIntervalRef.current = null;
      }
    };
  }, [announcements, overrideAnnouncement]);


  const handleAlertOk = async () => {
    const { isAnnouncement, timestamp, message } = alertModal;
    setAlertModal({ show: false, message: '', isAnnouncement: false, timestamp: null });

    if (!user || !user.uid) return;
    const userRef = doc(db, 'users', user.uid);

    try {
      if (isAnnouncement) {
        // user acknowledged the WINNER/NON-WINNER announcement
        // store ack locally so it won't prompt again, and show in announcement bar
        localStorage.setItem(`ackAnnouncement_${user.uid}`, timestamp);

        // Ensure the announcement bar displays it right away
        setAnnouncements(prev => {
          const withoutDuplicate = prev.filter(msg => msg !== message);
          return [message, ...withoutDuplicate];
        });
      } else {
        // this was an admin alert (approve/drop) => clear it server-side so it won't reappear
        await updateDoc(userRef, {
          alertMessage: '',
          alertTimestamp: null
        });
        // remember locally so we don't re-show if onSnapshot fires again
        if (timestamp) localStorage.setItem(`lastAlert_${user.uid}`, timestamp);
      }
    } catch (err) {
      console.error('handleAlertOk error:', err);
    }
  };

  // 📌 Cloudinary Upload Helper
const uploadToCloudinary = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "lp_unsigned_deposits"); // your preset
  formData.append("cloud_name", "dqjlufdxh"); // your cloud name

  const res = await fetch("https://api.cloudinary.com/v1_1/dqjlufdxh/image/upload", {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    throw new Error("Failed to upload image to Cloudinary");
  }

  const data = await res.json();
  return data.secure_url; // Public HTTPS URL
};


  const handleDepositRequest = async () => {
  if (!depositAmount || !depositScreenshot) {
    showToast('❌ Enter amount and upload screenshot.', 'error');
    return;
  }

  try {
    setLoading(true);
   
   // 1. Upload to Cloudinary
  const screenshotUrl = await uploadToCloudinary(depositScreenshot);

  // 2. Save deposit request in Firestore
  await addDoc(collection(db, 'depositRequests'), {
    uid: user.uid,
    userName: user.name || '',
    email: user.email || '',
    amount: parseFloat(depositAmount),
    screenshotUrl, // Cloudinary public URL
    status: 'pending',
    createdAt: serverTimestamp(),
  });

  // 3. Push to user's deposit history
  await updateDoc(doc(db, 'users', user.uid), {
    depositHistory: arrayUnion({
      amount: parseFloat(depositAmount),
      status: 'Pending',
      time: new Date().toISOString()
    })
  });

    setShowDepositModal(false);
    setDepositAmount('');
    setDepositScreenshot(null);
    setAlertModal({
      show: true,
      message: "✅ Your deposit request has been sent and will be approved soon.",
      isAnnouncement: false,
      timestamp: Date.now().toString()
    });

  } catch (error) {
    console.error(error);
    setAlertModal({
      show: true,
      message: "❌ Failed to send deposit request.",
      isAnnouncement: false,
      timestamp: Date.now().toString()
    });

  } finally {
    setLoading(false);
  }
};


const handleSaveAddress = async () => {
  if (!newAddress || newAddress.trim().length < 10) {
    showToast("❌ Please enter a valid USDT BEP-20 address.", "error");

    return;
  }

  try {
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      walletAddress: newAddress.trim()
    });

    setWithdrawalAddress(newAddress.trim());
    setNewAddress("");
    setShowAddressModal(false);
    showToast("✅ Withdrawal address updated successfully.", "success");

  } catch (error) {
    console.error("Error updating address:", error);
    showToast("❌ Failed to update address. Try again.", "error");

  }
};

const fetchWithdrawHistory = async () => {
  if (!user?.uid) return;
  const q = query(
    collection(db, "withdrawRequests"),
    where("uid", "==", user.uid)
  );
  const snapshot = await getDocs(q);
  
  const history = snapshot.docs.map(doc => ({
    amount: doc.data().amount,
    date: doc.data().createdAt?.toDate().toLocaleString() || "",
    status: doc.data().status || "pending"
  }));

  setWithdrawHistory(history);
};
const fetchDepositHistory = async () => {
  if (!user?.uid) return;
  const q = query(
    collection(db, "depositRequests"),
    where("uid", "==", user.uid)
  );
  const snapshot = await getDocs(q);
  
  const history = snapshot.docs.map(doc => ({
    amount: doc.data().amount,
    date: doc.data().createdAt?.toDate().toLocaleString() || "",
    status: doc.data().status || "pending"
  }));

  setDepositHistory(history);
};

const pools = [
  { id: 1, price: 50, reward: 1 },
  { id: 2, price: 100, reward: 2.5 },
  { id: 3, price: 200, reward: 5.5 },
  { id: 4, price: 300, reward: 8.5 },
  { id: 5, price: 500, reward: 15 },
  { id: 6, price: 700, reward: 22 },
  { id: 7, price: 1000, reward: 31 },
  { id: 8, price: 2000, reward: 65 },
  { id: 9, price: 3000, reward: 100 }, 
  { id: 10, price: 5000, reward: 180 },
  { id: 11, price: 10000, reward: 400 },
];

const handleBuyPool = async (pool) => {
  if (!user) return;

  try {
    // 🚫 Prevent buying the same pool twice
    if (purchasedPools.includes(pool.id)) {
      showToast(`❌ You already purchased Pool ${pool.id}`, "error");
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      showToast("User not found in database.", "error");
      return;
    }

    const userDataFromDb = userSnap.data();
    const poolWalletBalance = Number(userDataFromDb.poolWallet || 0);

    if (poolWalletBalance < pool.price) {
      showToast("❌ Not enough Pool Wallet balance. Please deposit first.", "error");
      return;
    }

    // ✅ Deduct from Pool Wallet
    const newPoolWallet = poolWalletBalance - pool.price;

    // 🔥 Remove all older pool purchases from user's purchases array
    const newPurchases = (userDataFromDb.purchases || [])
      .filter(p => !p.planId || !String(p.planId).startsWith("pool_"));

    // ✅ Ensure only one entry for this pool
    const updatedPurchases = [
      ...newPurchases.filter(p => !(p.planId && p.planId === `pool_${pool.id}`)),
      {
        planId: `pool_${pool.id}`,
        price: pool.price,
        reward: pool.reward,
        purchasedAt: Date.now()
      }
    ];

    // ✅ Update user's doc
    await updateDoc(userRef, {
      poolWallet: newPoolWallet,
      purchases: updatedPurchases
    });

    // 🔥 Delete all old pool purchases from "purchases" collection
    const purchasesRef = collection(db, "purchases");
    const oldPoolsQuery = query(
      purchasesRef,
      where("uid", "==", user.uid),
      where("type", "==", "pool")
    );
    const oldPoolsSnap = await getDocs(oldPoolsQuery);

    if (!oldPoolsSnap.empty) {
      const batch = writeBatch(db);
      oldPoolsSnap.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
    }

    // ✅ Add the new pool purchase
    await addDoc(purchasesRef, {
      uid: user.uid,
      userName: userDataFromDb.name || "Unknown",
      email: userDataFromDb.email || "",
      planId: `pool_${pool.id}`,
      type: "pool",
      price: pool.price,
      reward: pool.reward,
      approvedAt: serverTimestamp()
    });

    // ✅ Update local state
    setPoolWallet(newPoolWallet);
    setPurchases(updatedPurchases);
    setPurchasedPools(
      updatedPurchases
        .filter(p => p.planId && String(p.planId).startsWith("pool_"))
        .map(p => Number(p.planId.split("_")[1]))
    );

    showToast(`✅ Successfully bought Pool ${pool.id}`, "success");
  } catch (error) {
    console.error("Error buying pool:", error);
    showToast("❌ Error buying pool. Try again.", "error");
  }
};

const planNameMap = {
  1: "Silver Plan",
  2: "Gold Plan",
  3: "Diamond Plan"
};

const handleClaimReward = async (pool) => {
  if (!user || claiming) return; // 🚫 prevent spam clicks
  setClaiming(true);

  try {
    const now = Date.now();

    // 🔹 Get user from Firestore
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const data = userSnap.data();

    // 🔹 Check last claim timestamp (Firestore first, fallback to localStorage)
    const lastClaimFirestore = data?.poolClaims?.[pool.id] || 0;
    const claimKey = `lastClaim_${user.uid}_pool_${pool.id}`;
    const lastClaimLocal = Number(localStorage.getItem(claimKey) || 0);
    const lastClaim = Math.max(lastClaimFirestore, lastClaimLocal);

    // ⏳ Check if 24h passed
    if (now - lastClaim < 24 * 60 * 60 * 1000) {
      showToast("⏳ You already claimed. Try again later.", "warning");
      setClaiming(false);
      return;
    }

    // 🔹 Add reward
    const newBalance = (data.wallet || 0) + pool.reward;

    // 🔹 Update Firestore (wallet + lastClaim for this pool)
    await updateDoc(userRef, {
      wallet: newBalance,
      [`poolClaims.${pool.id}`]: now, // ✅ Save last claim server-side
      alertMessage: `✅ Claimed daily reward $${pool.reward} from Pool ${pool.id}`,
      alertTimestamp: serverTimestamp(),
    });

    // 📝 Save claim timestamp (local + state)
    localStorage.setItem(claimKey, now.toString());
    setLastClaims((prev) => ({ ...prev, [pool.id]: now }));

    // 📝 Update wallet instantly
    setWallet(newBalance);

    // ✅ Success message
    showToast(`✅ Claimed $${pool.reward} from Pool ${pool.id}`, "success");
  } catch (err) {
    console.error("Error claiming reward:", err);
    showToast("❌ Error claiming reward.", "error");
  } finally {
    setClaiming(false);
  }
};

const CountdownTimer = ({ targetTime }) => {
  const [timeLeft, setTimeLeft] = useState(targetTime - Date.now());

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(targetTime - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  if (timeLeft <= 0) return <span>Ready ✅</span>;

  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor(
    (timeLeft % (1000 * 60 * 60)) / (1000 * 60)
  );
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  return (
    <span style={{ fontWeight: "700", fontSize: "15px", color: "#facc15" }}>
      ⏳ {days}d {hours}h {minutes}m {seconds}s
    </span>
  );
};

// 🏆 Format pool name nicely
const formatPlanName = (planId) => {
  if (planId.startsWith("pool_")) {
    const num = planId.split("_")[1];
    return `🏆 Pool ${num}`;
  }
  return planId; // fallback for non-pool items
};

const handleExchange = async () => {
  const amount = Number(exchangeAmount);

  if (!amount || amount <= 0) {
    showToast("❌ Enter a valid amount.", "error");
    return;
  }

  if (amount > wallet) {
    showToast("❌ Not enough balance in wallet.", "error");
    return;
  }

  setIsExchanging(true); // ✅ start loading

  try {
    const newWallet = wallet - amount;
    const newPoolWallet = poolWallet + amount;

    // Update in Firestore
    await updateDoc(doc(db, "users", user.uid), {
      wallet: newWallet,
      poolWallet: newPoolWallet
    });

    // Update local state
    setWallet(newWallet);
    setPoolWallet(newPoolWallet);

    showToast(`✅ Successfully moved $${amount} to Pool Wallet.`, "success");

    // ✅ clear + close modal
    setExchangeAmount("");
    setShowExchangeModal(false);
  } catch (error) {
    console.error("Exchange error:", error);
    showToast("❌ Exchange failed, try again.", "error");

    // close modal & reset field
    setExchangeAmount("");
    setShowExchangeModal(false);
  } finally {
    setIsExchanging(false); // ✅ stop loading
  }
};

const handleClaimTeamReward = async () => {
  if (!user || loadingTeamReward) return; // 🚫 prevent spam until Firestore sync

  try {
    setLoadingTeamReward(true);

    // 🎯 Reward calculation
    const baseReward = 170;
    const extraReward = teamCount > 35 ? (teamCount - 35) * 5 : 0;
    const totalReward = baseReward + extraReward;

    const userRef = doc(db, "users", user.uid);

    await updateDoc(userRef, {
      wallet: (userData.wallet || 0) + totalReward, // add to withdrawable wallet
      lastTeamClaim: Date.now(),
      teamRewardsHistory: arrayUnion({
        amount: totalReward,
        teamCount,
        time: new Date().toISOString(),
      }),
    });

    // Update local instantly
    setWallet((prev) => prev + totalReward);
    setLastTeamClaim(Date.now());

    showToast(`🎉 Team Reward $${totalReward} added to your wallet!`, "success");
  } catch (err) {
    console.error("Team reward error:", err);
    showToast("❌ Error claiming team reward.", "error");
  } finally {
    setLoadingTeamReward(false);
  }
};

  return (
    <div className="container">
      <div className="header" style={{display:'flex'}}>
        <div className="top-buttons">
          
          <button 
            className="mainBtn" 
            style={{ borderRadius: '30px', background: '#324674' }} 
            onClick={() => setShowProfile(true)}
          >
            <img 
              src={Icon} 
              alt="Profile Icon" 
              style={{ width: '20px', height: '20px' }} 
            />
          </button>

          <div style={{display:'flex'}}><img src={Logo2} style={{width:'25px'}} /> <img src={Logo} style={{width:'45px', marginTop:'10%'}} /></div>
        </div>
        <button 
          style={{ borderRadius: '30px', background: 'transparent', border: 'none', cursor: 'pointer' }} 
          onClick={handleLogout}
        >
          <img 
            src={L_Icon} 
            alt="Logout Icon" 
            style={{ width: '20px', height: '20px' }} 
          />
        </button>

        </div>
        <div style={{ 
        background: "#32467443", 
        padding: "10px 15px", 
        display: "flex", 
        borderRadius:'10px',
        placeSelf:'center',
        width:'70%',
        justifyContent:'center',
        marginTop:'2%',
      }}>
        <h1 style={{ 
          color: "#ffd700", 
          fontSize: "16px", 
          fontWeight: 200, 
          margin: 0 
        }}>
          🎉 Welcome {user?.name || "Guest"}
        </h1>
      </div>  
        <div className="announcement-wrap">
          <div className="marquee">
            <span>
              {overrideAnnouncement ?? (announcements.length ? announcements[currentAnnouncementIndex] : '📣 No current winner announcements.')}
            </span>
            <span>
              {overrideAnnouncement ?? (announcements.length ? announcements[currentAnnouncementIndex] : '📣 No current winner announcements.')}
            </span>
            <span>
              {overrideAnnouncement ?? (announcements.length ? announcements[currentAnnouncementIndex] : '📣 No current winner announcements.')}
            </span>
            <span>
              {overrideAnnouncement ?? (announcements.length ? announcements[currentAnnouncementIndex] : '📣 No current winner announcements.')}
            </span>
            <span>
              {overrideAnnouncement ?? (announcements.length ? announcements[currentAnnouncementIndex] : '📣 No current winner announcements.')}
            </span>
          </div>
        </div>

      <br/>

      <div className="row">
        <div className="box" style={{display:'flex',  background: "linear-gradient(145deg, #0f172a, #1e293b)", boxShadow: "0 8px 30px rgba(0,0,0,0.45), 0 0 25px rgba(255, 215, 0, 0.15)"}}>
          
          <div style={{width:'50%'}}>
            <h4>Wallet balance</h4>
            <p className="wallet">${(Number(wallet) || 0).toFixed(2)}</p>
            
          </div>
          
          <div style={{display: 'grid', gap: '20px', marginTop: '8px', width:'60%', height:'30%' }}>
            <button className="mainBtn" style={{
                  background: "linear-gradient(90deg, #00ffe0, #0099ff)",
                  color: "#000",
                  fontWeight: "700",
                  padding: "16px 30px",
                  borderRadius: "14px",
                  boxShadow: "0 0 18px rgba(0,255,255,0.6)",
                  transition: "all 0.3s ease",
                  width: "95%",
                  justifyContent:'center',
                }} onClick={() => setShowDepositModal(true)}>📥 Deposit</button>
            <button className="mainBtn" style={{
                  background: "linear-gradient(90deg, #00ffe0, #0099ff)",
                  color: "#000",
                  fontWeight: "700",
                  padding: "16px 30px",
                  borderRadius: "14px",
                  boxShadow: "0 0 18px rgba(0,255,255,0.6)",
                  transition: "all 0.3s ease",
                  width: "95%",
                  justifyContent:'center',
                }} onClick={() => setShowWithdrawModal(true)}>📤 Cash out</button>
          </div>
        </div>

      </div>

          <div  style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', rowGap:'0%' }}>
            <button 
              onClick={() => setShowPools(true)}
              className="mainBtn" 
              style={{
                height:'150%',
                background:'#141414',
                border:'1px dashed #324674ff',
                borderRadius:'10px',
                 display:'flex',
                flexDirection:'column',
                alignItems:'center',
                justifyContent:'center',
                padding:'8px'
              }}
            >   

                <span style={{ color:'#ffffff', fontWeight:'bold', fontSize:'20px' }}>Pool Balance</span>
  
              <span style={{ color:'#00e676', fontWeight:'bold', fontSize:'20px' }}>${poolWallet.toFixed(2)} </span>

              {/* White separator line */}
                <div 
                  style={{
                    width: "80%",        // adjust width as needed
                    height: "1px", 
                    backgroundColor: "white", 
                    margin: "6px 0"
                  }}
                />

                <span 
                className="attentionBox animate"
                style={{
                  fontSize: "22px",
                  fontWeight: "700",
                  marginBottom: "8px",
                  color: "#534700ff",
                  background: "#ffd700",
                  padding: "20px 50px",
                  borderRadius: "15px",
                  
                }}
              >
                🏆 BUY POOLS
              </span>


            </button>

            
          </div>

          

         <br/>
         <br/>
         <br/>
         <br/>
         <br/>
         <br/>

          <div  style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', rowGap:'65%' }}>
            <button className="mainBtn" style={{height:'200%',background:'#141414', border:'1px dashed #324674ff', justifyContent:'center', borderRadius:'10px' }} onClick={() => setShowPurchases(true)}>🛒 Purchases</button>
            <button className="mainBtn" style={{height:'200%',background:'#141414', border:'1px dashed #324674ff', justifyContent:'center', borderRadius:'10px' }} onClick={() => { setShowHistory(true); }}>📜 History</button>
            <button className="mainBtn" style={{height:'200%',background:'#141414', border:'1px dashed #324674ff', justifyContent:'center', borderRadius:'10px' }} onClick={() => setShowAddressModal(true)}>
              {withdrawalAddress ? '✏️ Wallet' : '➕ Add Wallet'}
            </button>
                        <button className="mainBtn" style={{height:'200%',background:'#141414', border:'1px dashed #324674ff', borderRadius:'10px', justifyContent:'center'}} onClick={() => setShowExchangeModal(true)}>
             💱 Exchange
            </button>

          </div>
     
      <br/>
      <br/>
      <br/>
      <br/>
      <br/>
      <br/>
      <br/>
      <br/>
      <br/>
     
      {/* Reward Box always visible */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          margin: "0 auto",
          padding: "0 12px",   // ✅ small horizontal padding only
          boxSizing: "border-box", // ✅ prevent overflow
        }}
      >
        <div
          style={{
            background: "linear-gradient(145deg, #0f172a, #1e293b)", // futuristic gradient
            borderRadius: "20px",
            padding: "28px 24px",
            textAlign: "center",
            boxShadow: "0 8px 30px rgba(0,0,0,0.45), 0 0 25px rgba(255, 215, 0, 0.15)",
            width: "100%",
            maxWidth: "440px",
            margin: "0 auto",    // ✅ ensures centering
            position: "relative",
            overflow: "hidden",
            boxSizing: "border-box", // ✅ ensures no overflow on mobile
          }}
        >
          {/* Futuristic glow border */}
          <div
            style={{
              position: "absolute",
              top: "-2px",
              left: "-2px",
              right: "-2px",
              bottom: "-2px",
              borderRadius: "22px",
              padding: "2px",
              background:
                "linear-gradient(135deg, #ffd700, #ff6a00, #00ffe0, #ffd700)",
              backgroundSize: "400% 400%",
              animation: "borderGlow 10s ease infinite",
              zIndex: "-1",
            }}
          />

          <h2
            style={{
              fontSize: "22px",
              fontWeight: "700",
              background: "linear-gradient(90deg, #ffd700, #ffae42)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: "16px",
              letterSpacing: "0.5px",
            }}
          >
            🚀 Buy Pools & Unlock{" "}
            <span style={{ color: "#00ffe0", textShadow: "0 0 8px #00ffe0" }}>
              Daily Income
            </span>
          </h2>

          <h3
            style={{
              color: "#ffd700",
              fontSize: "22px",
              fontWeight: "600",
              marginBottom: "8px",
            }}
          >
            🏆 Pool {purchasedPools.length ? Math.max(...purchasedPools) : 0}
          </h3>
          <p style={{ color: "#cbd5e1", fontSize: "15px", marginBottom: "18px" }}>
            🎁 Daily Reward: $
            {purchasedPools.length
              ? (
                  pools.find((p) => p.id === Math.max(...purchasedPools))?.reward || 0
                ).toFixed(2)
              : "0.00"}
          </p>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {claiming ? (
              <button
                className="mainBtn"
                disabled
                style={{
                  background: "#4b5563",
                  color: "#fff",
                  padding: "14px 70px",
                  borderRadius: "12px",
                  fontWeight: "600",
                  cursor: "not-allowed",
                }}
              >
                Claiming...
              </button>
            ) : lastClaims[Math.max(...purchasedPools, 0)] &&
              Date.now() - lastClaims[Math.max(...purchasedPools, 0)] <
                24 * 60 * 60 * 1000 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <button
                  className="mainBtn"
                  disabled
                  style={{
                    background: "linear-gradient(90deg, #64748b, #475569)",
                    color: "#fff",
                    padding: "16px 60px",
                    borderRadius: "14px",
                    fontWeight: "700",
                    cursor: "not-allowed",
                    boxShadow: "inset 0 0 12px rgba(255,255,255,0.2)",
                  }}
                >
                  ✅ Claimed
                </button>

                {/* Countdown BELOW the button */}
                <div
                  style={{
                    marginTop: "10px",
                    fontSize: "15px",
                    fontWeight: "600",
                    color: "#00ffe0",
                    textShadow: "0 0 6px rgba(0,255,255,0.7)",
                  }}
                >
                  <CountdownTimer
                    targetTime={
                      lastClaims[Math.max(...purchasedPools, 0)] +
                      24 * 60 * 60 * 1000
                    }
                  />
                </div>
              </div>
            ) : purchasedPools.length ? (
              <button
                className="mainBtn"
                onClick={() =>
                  handleClaimReward(
                    pools.find((p) => p.id === Math.max(...purchasedPools))
                  )
                }
                style={{
                  background: "linear-gradient(90deg, #ffd700, #ffae42)",
                  color: "#000",
                  fontWeight: "700",
                  padding: "16px 70px",
                  borderRadius: "14px",
                  boxShadow: "0 0 18px rgba(255,215,0,0.6)",
                  transition: "all 0.3s ease",
                }}
              >
                ✨ Claim Reward 🎟️
              </button>
            ) : (
              <button
                className="mainBtn"
                onClick={() => setShowPools(true)} // ✅ open pools modal
                style={{
                  background: "linear-gradient(90deg, #00ffe0, #0099ff)",
                  color: "#000",
                  fontWeight: "700",
                  padding: "16px 70px",
                  borderRadius: "14px",
                  boxShadow: "0 0 18px rgba(0,255,255,0.6)",
                  transition: "all 0.3s ease",
                }}
              >
                💰 Buy Now
              </button>
            )}
          </div>
        </div>
      </div>

      <br/> 

      <h2 className="animated-heading"> Buy our exclusive plans <br/> <span className="typing">✓ {animatedText}|</span></h2>
      <br/> 
      <div className="sliderContainer">
        {plans.map((plan) => (
        <div
          key={plan.id}
          className={`planCard plan-${plan.id}`}
          onClick={() => {
            if (pendingPlanIds.includes(plan.id)) {
              showToast(`⏳ You already requested to buy ${planNameMap[plan.id]}... Will be approved within 12 hours ⏰.`, 'warning');

              return;
            }
            const activePurchase = purchases.find(p => p.planId === plan.id);
            if (activePurchase) {
              if (!activePurchase.expiresAt || Date.now() < activePurchase.expiresAt) {
                showToast(`⏳ You already purchased ${planNameMap[plan.id]}. Wait for the lucky draw to end.`, 'warning');

                return;
              }
            }

            setSelectedPlan(plan);
            setShowBuyModal(true);
          }}
        >
          <h3
            className={`badge ${
              plan.id === 1
                ? "badge-silver"
                : plan.id === 2
                ? "badge-gold"
                : "badge-diamond"
            }`}
          >
            {plan.id === 1
              ? "Silver Plan"
              : plan.id === 2
              ? "Gold Plan"
              : "Diamond Plan"}
          </h3>

          <p>💵 Price: ${plan.price}</p>
          <p>⏳ Duration: {plan.days} days</p>
          <p>🏆 Reward: ${plan.reward}</p>
          <br/>
          <p>💸 Lucky Draw Countdown</p>
          <p>⏳ {planCountdowns[`plan_${plan.id}`] || "Loading..."}</p>
          <br/>
          <br/>
          <p style={{fontSize:'10px'}}>Once plan is bought, you will be added in lucky draw</p>
        </div>

        ))}
      </div>
       <br/>
       <br/>
       <br/>
     
          <p style={{textAlign:'center' , fontSize:'0.6rem'}}>© 2025 Veon. All rights reserved.</p> 
      
          
      {/* Modals */}
      {showBuyModal && selectedPlan && (
        <div className="modalOverlay">
          <div className="modal">
            <h3>Buy {selectedPlan.id === 1? "Silver Plan" : selectedPlan.id === 2 ? "Gold Plan" : "Diamond Plan"} </h3>
            <p>Price: ${selectedPlan.price}</p>
            <p>Luckdraw: {selectedPlan.days} Days</p>
            <p>Countdown {planCountdowns[`plan_${selectedPlan.id}`] || "Loading..."}</p>

            <button className="primaryBtn" onClick={handleBuyWithWallet} disabled={loading}>
              {loading ? 'Buying...' : '💰 Buy from Wallet'}
            </button>

            <button className="cancelBtn" onClick={() => setShowBuyModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {showWithdrawModal && (
      <div className="modalOverlay">
        <div className="modal">
          <h3>Request Withdrawal</h3>
          <input
            type="number"
            className="input"
            placeholder="Enter amount"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
          />

          {/* Error conditions */}
          {!userData?.walletAddress && (
            <p style={{ color: "red", fontSize: "14px" }}>
              ⚠️ Please add your wallet address first!
            </p>
          )}
          {withdrawAmount > 0 && withdrawAmount < 50 && (
            <p style={{ color: "red", fontSize: "14px" }}>
              ⚠️ Minimum withdrawal amount is $50
            </p>
          )}

          <button
            className="primaryBtn"
            onClick={handleWithdrawRequest}
            disabled={
              loading ||
              !userData?.walletAddress ||      // ❌ Block if no wallet
              withdrawAmount < 50              // ❌ Block if < $50
            }
          >
            {loading ? "Sending..." : "Withdraw"}
          </button>

          <button
            className="cancelBtn"
            onClick={() => setShowWithdrawModal(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    )}

      {showAddressModal && (
        <div className="modalOverlay">
          <div className="modal">
            <h3>Add USDT (BEP-20) Wallet Address</h3>
            <input
              className="input"
              type="text"
              placeholder="0x..."
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
            />
            <button className="primaryBtn" onClick={handleSaveAddress}disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
            <button className="cancelBtn" onClick={() => setShowAddressModal(false)}>Cancel</button>
          </div>
        </div>
      )}

     {showProfile && (
        <div className="modalOverlay" onClick={() => setShowProfile(false)}>
          <div 
            className="modal" 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              maxHeight: "80vh", 
              overflowY: "auto", 
              background: "linear-gradient(135deg, #1f1f2e, #2a2a40)", 
              borderRadius: "16px", 
              padding: "20px", 
              boxShadow: "0 8px 25px rgba(0,0,0,0.6)", 
              position: "relative"
            }}
          >
            {/* Close Button */}
            <button 
              onClick={() => setShowProfile(false)} 
              className="cancelBtn" 
              style={{ 
                position: "absolute", 
                top: "15px", 
                right: "15px", 
                fontSize: "16px" 
              }}
            >
              ✖
            </button>

            {/* Profile Header */}
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div 
                style={{ 
                  width: "90px", 
                  height: "90px", 
                  borderRadius: "50%", 
                  background: "linear-gradient(135deg, #ffd700, #ffb400)", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  fontSize: "36px", 
                  fontWeight: "bold", 
                  color: "#000", 
                  margin: "0 auto 10px auto", 
                  boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
                }}
              >
                {userData?.name ? userData.name.charAt(0).toUpperCase() : "👤"}
              </div>
              <h2 style={{ margin: "10px 0 5px", color: "#ffd700" }}>
                {userData?.name || "Guest User"}
              </h2>
              <p style={{ color: "#bbb", fontSize: "14px" }}>
                {userData?.email || "No email set"}
              </p>
            </div>

            {/* Profile Details */}
            <div style={{ marginBottom: "15px" }}>
              <div className="profile-row">
                <span>📱 Phone</span>
                <span>{userData?.phone || "N/A"}</span>
              </div>
              <div className="profile-row">
                <span>💳 Wallet Address</span>
                <span style={{ wordBreak: "break-word", maxWidth: "200px", textAlign: "right" }}>
                  {userData?.walletAddress || "N/A"}
                </span>
              </div>
              <div className="profile-row">
                <span>🧑‍🤝‍🧑 Reference</span>
                <span>
                  {userData?.referenceBy
                    ? (userData.referenceBy === "SELF" 
                        ? "SELF" 
                        : userData.referenceName || userData.referenceBy)
                    : "SELF"}
                </span>
              </div>
            </div>

            {/* Invite Link Section */}
            <div style={{ marginTop: "20px" }}>
              <label style={{ fontWeight: "bold", color: "#ffd700" }}>🔗 Invite Link</label>
              <div 
                style={{ 
                  display: "flex", 
                  alignItems: "stretch", 
                  gap: "0", 
                  marginTop: "5px" 
                }}
              >
                <input
                  type="text"
                  value={`${window.location.origin}/signup?ref=${user?.uid}`}
                  readOnly
                  style={{ 
                    flex: 1, 
                    background: "#2c2c44", 
                    color: "#fff",
                    padding: "10px 12px", 
                    border: "1px solid #444",
                    borderRight: "none", 
                    borderRadius: "6px 0 0 6px", 
                    fontSize: "14px"
                  }}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/signup?ref=${user?.uid}`);
                    showToast("Referral link copied!", "success");
                  }}
                  style={{ 
                    background: "#2196F3", 
                    color: "#fff",
                    border: "1px solid #444",
                    borderLeft: "none", 
                    borderRadius: "0 6px 6px 0", 
                    padding: "0 15px", 
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  📋 Copy
                </button>
              </div>
            </div>          

            {/* Profile Actions */}

             {/* 🏆 Team Reward Box */}
              <div
                style={{
                  background: "linear-gradient(145deg, #0f172a, #1e293b)",
                  borderRadius: "20px",
                  padding: "24px",
                  margin: "20px auto",
                  textAlign: "center",
                  boxShadow: "0 8px 25px rgba(0,0,0,0.4), 0 0 20px rgba(0,255,255,0.15)",
                  width: "80%",
                  maxWidth: "440px",
                  position: "relative",
                }}
              >
                <h2
                  style={{
                    fontSize: "20px",
                    fontWeight: "700",
                    color: "#ffd700",
                    marginBottom: "14px",
                  }}
                >
                  👥 Team Reward
                </h2>

                {/* States */}
                {loadingTeamReward ? (
                  <button
                    disabled
                    style={{
                      background: "#4b5563",
                      color: "#fff",
                      padding: "14px 70px",
                      borderRadius: "12px",
                      fontWeight: "600",
                      cursor: "not-allowed",
                    }}
                  >
                    Loading...
                  </button>
                ) : teamCount < 35 ? (
                  <button
                    disabled
                    style={{
                      background: "#374151",
                      color: "#9ca3af",
                      padding: "14px 70px",
                      borderRadius: "12px",
                      fontWeight: "600",
                      cursor: "not-allowed",
                    }}
                  >
                    Team ({teamCount})
                  </button>
                ) : Date.now() - (lastTeamClaim || 0) < 30 * 24 * 60 * 60 * 1000 ? (
                  // ✅ Countdown shown inside button
                  <button
                    disabled
                    style={{
                      background: "linear-gradient(90deg, #64748b, #475569)",
                      color: "#fff",
                      padding: "16px 40px",
                      borderRadius: "14px",
                      fontWeight: "700",
                      cursor: "not-allowed",
                      minWidth: "250px",
                    }}
                  >
                    Claimed Team reward ({teamCount}) <br/>
                    <CountdownTimer
                      targetTime={lastTeamClaim + 30 * 24 * 60 * 60 * 1000}
                    />
                  </button>
                ) : (
                  <button
                    onClick={handleClaimTeamReward}
                    disabled={loadingTeamReward}
                    style={{
                      background: "linear-gradient(90deg, #00ffe0, #0099ff, #00ffe0)",
                      color: "#000",
                      padding: "16px 70px",
                      borderRadius: "14px",
                      fontWeight: "700",
                      boxShadow: "0 0 20px rgba(0,255,255,0.6)",
                      transition: "all 0.3s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.05)";
                      e.currentTarget.style.boxShadow =
                        "0 0 30px rgba(0,255,255,0.9), 0 0 50px rgba(0,255,255,0.7)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.boxShadow =
                        "0 0 20px rgba(0,255,255,0.6)";
                    }}
                  >
                    Team ({teamCount}) Claim Reward
                  </button>
                )}
              </div>

            <div style={{ textAlign: "center", marginTop: "25px" }}>
              {user && (
                <button
                  onClick={() => {
                    setAlertModalConfirm({
                      show: true,
                      message: "Do you want to reset your password?",
                      onConfirm: async () => {
                        try {
                          await sendPasswordResetEmail(auth, user.email);
                          showToast("📩 Password reset email sent!", "success");
                        } catch (err) {
                          showToast("❌ Failed to send reset email", "error");
                          console.error("Reset email error:", err);
                        }
                      }
                    });
                  }}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "10px",
                    background: "#324674",
                    color: "#fff",
                    fontWeight: "bold",
                    marginBottom: "10px"
                  }}
                >
                  🔑 Change Password
                </button>
              )}

              {user ? (
                <button 
                  className="logoutBtn" 
                  onClick={handleLogout} 
                  disabled={loading} 
                  style={{ 
                    width: "100%", 
                    padding: "10px", 
                    borderRadius: "10px", 
                    background: "#d9534f", 
                    color: "#fff", 
                    fontWeight: "bold" 
                  }}
                >
                  {loading ? "Bye..." : "🚪 Logout"}
                </button>
              ) : (
                <button 
                  onClick={() => navigate("/login")} 
                  style={{ 
                    width: "100%", 
                    padding: "10px", 
                    borderRadius: "10px", 
                    background: "green", 
                    color: "#fff", 
                    fontWeight: "bold", 
                    cursor: "pointer" 
                  }}
                >
                  🔑 Login
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Purchases Modal */}
      {showPurchases && (
        <div className= "modalOverlay" onClick={() => setShowPurchases(false)}>
          <div className= "modal" style={{ maxHeight: '80vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            {/* Purchases Section */}
            <div className="section">
              <button onClick={() => setShowPurchases(false)} className="cancelBtn" style={{ marginLeft:'85%' }}>X</button>
              <h2 className="section-title">🛒 Your Purchases</h2>
              {purchases.length === 0 ? (
                <p className="no-purchase">No purchases yet.</p>
              ) : (
                <div className="purchases-grid">
                  {purchases.map((purchase, index) => (
                    <div className="purchase-card" key={index} style={{display:'flex'}}>

                    <h3 className="purchase-title">
                      {planNameMap[purchase.planId] || formatPlanName(purchase.planId)}
                    </h3>

                      <p className="purchase-date" style={{marginLeft: 'auto'}}><span className="status-approved"> ✅🛍️ </span></p>
                    </div> 
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transactions History Modal */}
      {showHistory && (
        <div className="modalOverlay" onClick={() => setShowHistory(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <button onClick={() => setShowHistory(false)} className="cancelBtn" style={{ marginLeft: '85%' }}>X</button>
            <h3>📜 Transaction History</h3>

            {combinedHistory.length === 0 ? (
              <p style={{ textAlign: "center", color: "#aaa" }}>No history yet.</p>
            ) : (
              <div className="history-grid">
                {combinedHistory.map((item, index) => (
                  <div key={index} className="history-card" style={{
                    background: "#1e1e2f",
                    margin: "8px 0",
                    padding: "10px",
                    borderRadius: "8px",
                    borderLeft: item.type === "deposit" ? "4px solid limegreen"
                      : item.type === "withdraw" ? "4px solid red"
                      : "4px solid gold"
                  }}>
                    <p>
                      {item.type === "deposit" && `💰 Deposit — $${item.amount} + $${(item.amount)*0.5} bouns (${item.status})`}
                      {item.type === "withdraw" && `💸 Withdrawal — $${item.amount} (${item.status})`}
                      {item.type === "planWin" && `🏆 Won ${item.planName} — $${item.amount}`}
                      {item.type === "teamReward" && `👥 Team Reward — $${item.amount} (Team: ${item.teamCount})`}
                    </p>
                    <small style={{ color: "#bbb" }}>
                      {new Date(item.time).toLocaleString()}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Alert Modal */} 
      {alertModal.show && ( 
        <div className="modalOverlay">
          <div className="modal">
           <h3>📢 Announcement</h3> 
           <p>{alertModal.message}</p>
            <button className="primaryBtn" onClick={handleAlertOk}>OK</button>
          </div> 
        </div> 
      )}
      
      {alertModalConfirm.show && (
        <div className="modalOverlay">
          <div className="modal">
              <button className="cancelBtn" style={{ marginLeft:'85%' }} onClick={() => setAlertModalConfirm({ show: false, message: "" })} >X</button>
            <h3>📢 Confirmation</h3>
            <p>{alertModalConfirm.message}</p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                className="primaryBtn"
                onClick={() => {
                  if (alertModalConfirm.onConfirm) alertModalConfirm.onConfirm(); 
                    setAlertModalConfirm({ show: false, message: "" });}}>Yes
              </button>
            </div>
          </div>
        </div>
      )}


      {showDepositModal && (
        <div className="modalOverlay">
          <div className="modal">
            <h3>Deposit Funds</h3>
            <input
              type="number"
              className="input"
              placeholder="Enter amount"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
            <div style={{ marginTop: "20px" }}>
              <label style={{ fontWeight: "bold", color: "#ffd700" }}>🔗 USDT (BEP-20) Wallet address</label>
              <div 
                style={{ 
                  display: "flex", 
                  alignItems: "stretch", // ✅ makes input & button same height
                  gap: "0", 
                  marginTop: "5px" 
                }}
              >
                <input
                  type="text"
                  value={'0xA5aFDCA217426C6ad0f2DA726b84DFDbeBb27aD6'}
                  readOnly
                  style={{ 
                    flex: 1, 
                    background: "#2c2c44", 
                    color: "#fff",
                    border: "1px solid #444",
                    borderRight: "none",          // ✅ merges seamlessly with button
                    borderRadius: "6px 0 0 6px",  // ✅ rounded left only
                    fontSize: "14px",
                    padding:"10px"
                  }}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('0xA5aFDCA217426C6ad0f2DA726b84DFDbeBb27aD6');
                    showToast("Wallet Address Copied!", "success");
                  }}
                  style={{ 
                    background: "#fff", 
                    color: "#2c2c44",
                    border: "1px solid #444",
                    borderLeft: "none",           // ✅ merges with input
                    borderRadius: "0 6px 6px 0",  // ✅ rounded right only
                    padding: "0 15px", 
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  📋 Copy
                </button>
              </div>
            </div> 
              
            <input type="file" accept="image/*" onChange={(e) => setDepositScreenshot(e.target.files[0])} />
            <button className="primaryBtn" onClick={handleDepositRequest} disabled={loading}>{loading ? 'Sending...' : 'Submit'}</button>
            <button className="cancelBtn" onClick={() => setShowDepositModal(false)}>Cancel</button>
          </div>
        </div>
      )}
      {showPools && (
        <div className="modalOverlay">
          <div className="modal" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <button onClick={() => setShowPools(false)} className="cancelBtn" style={{ marginLeft:'85%' }}>X</button>
            <h3>🏆 Available Pools</h3>

            {(() => {
              // ✅ Always find the maximum purchased pool
              const maxPool = purchasedPools.length > 0 ? Math.max(...purchasedPools) : 0;

              return (
                <div style={{ display: 'grid', gap: '08px' }}>
                  {pools.map(pool => {
                    const isPurchased = purchasedPools.includes(pool.id);
                    const isSmaller = pool.id < maxPool;

                    return (
                      <div
                        key={pool.id}
                        style={{
                          background: isPurchased
                            ? "linear-gradient(135deg, #1e3c72, #2a5298)" // purchased
                            : isSmaller
                              ? "#555" // smaller than highest -> greyed
                              : "linear-gradient(135deg, #2c2f48, #1a1c2c)", // available
                          opacity: isSmaller ? 0.6 : 1,
                          pointerEvents: isSmaller ? "none" : "auto",
                          padding: "20px",
                          borderRadius: "15px",
                          boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          textAlign: "center",
                          transition: "transform 0.2s ease, box-shadow 0.2s ease",
                        }}
                      >
                        <h3 style={{ color: isSmaller ? "#ccc" : "#ffd700", marginBottom: "10px" }}>
                          🏆 Pool {pool.id}
                        </h3>
                        <p style={{ fontSize: "14px", color: isSmaller ? "#ddd" : "#fff" }}>
                          💵 Price: <b>${pool.price}</b>
                        </p>
                        <p style={{ fontSize: "14px", color: isSmaller ? "#ddd" : "#fff" }}>
                          🎁 Reward: <b>${pool.reward}</b>
                        </p>

                        {isPurchased ? (
                          <button 
                            className="mainBtn"
                            style={{
                              color: "#000",
                              marginTop: "10px",
                              width: "100%",
                              borderRadius: "10px",
                              background: "#ffd700",
                              fontWeight: "bold"
                            }}
                            disabled
                          >
                            ✅ Upgraded
                          </button>
                        ) : (
                          !isSmaller && (
                            <button
                              className="mainBtn"
                              style={{
                                marginTop: "10px",
                                width: "100%",
                                borderRadius: "10px",
                                background: "#ffd700",
                                color: "#000",
                                fontWeight: "bold",
                              }}
                              onClick={() => handleBuyPool(pool)}
                              disabled={!userLoaded || loading}
                            >
                              {loading ? "Buying..." : "Upgrade"}
                            </button>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {showExchangeModal && (
        <div className="modalOverlay">
          <div className="modal">
            <h3>💱 Exchange to Pool Wallet</h3>
            <p style={{ fontSize:"14px", color:"#bbb" }}>
              Convert balance from <b>Wallet</b> → <b>Pool Wallet</b>.
            </p>
            <input
              type="number"
              className="input"
              placeholder="Enter amount"
              value={exchangeAmount}
              onChange={(e) => setExchangeAmount(e.target.value)}
            />
            <button 
              className="primaryBtn" 
              onClick={handleExchange} 
              disabled={isExchanging}
            >
              {isExchanging ? "Exchanging..." : "Exchange"}
            </button>
            <button className="cancelBtn" onClick={() => setShowExchangeModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Home;
