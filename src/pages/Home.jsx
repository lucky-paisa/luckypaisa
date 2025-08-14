import './styles/Home.css';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';  
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
  arrayUnion
} from 'firebase/firestore';
import { db } from '../firebase';
import Logo from '../assets/Logo.png';



const Home = () => {
  const { user, logout } = useAuth();
  const [planWins, setPlanWins] = useState([]);
  const [poolWins, setPoolWins] = useState([]);
  const approvedPlanIdsRef = useRef(new Set()); // tracks which planIds we've already toasted for
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
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositScreenshot, setDepositScreenshot] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [withdrawHistory, setWithdrawHistory] = useState([]);
  const [depositHistory, setDepositHistory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  // keep freshest copies to avoid stale closures in listeners
  const latest = {
    purchases: null,
    pendingPlanIds: null,
  };
  useEffect(() => { latest.purchases = purchases; }, [purchases]);
  useEffect(() => { latest.pendingPlanIds = pendingPlanIds; }, [pendingPlanIds]);

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
    setPoolWins(data.poolWins || []);
    setPlanWins(data.planWins || []);

    // ✅ Keep purchased pools in sync
    const purchasedPoolIds = (updatedPurchases || [])
      .filter(p => String(p.planId).startsWith("pool_"))
      .map(p => Number(p.planId.split("_")[1]));
    setPurchasedPools(purchasedPoolIds);  

    // keep user fields in state
    setUserData(data);
    setWallet(data.wallet || 0);
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
        const raw = w.timestamp;
        const ts = raw?.toDate?.() ? raw.toDate().getTime()
                : raw instanceof Date ? raw.getTime()
                : typeof raw === 'number' ? raw
                : 0;
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

  });


 // ✅ Real-time listener for approved plans in 'purchases' collection
 // ✅ Real-time listener for approved plans in 'purchases' collection (deduped + fresh state)
const purchasesRef = query(
  collection(db, 'purchases'),
  where('uid', '==', user.uid)
);

const unsubscribePurchases = onSnapshot(purchasesRef, async (querySnapshot) => {
  // Build the full set from the server
  const incoming = [];
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    incoming.push({
      planId: data.planId,
      status: 'approved',
      purchasedAt: data.approvedAt?.toDate?.()?.getTime?.() ?? Date.now(),
      expiresAt: data.expiresAt ?? null
    });
  });

  // Merge into local state without duplicates using functional update
  setPurchases((prev) => {
    const byId = new Map(prev.map(p => [String(p.planId), p]));
    for (const p of incoming) {
      const key = String(p.planId);
      // Prefer incoming fields but keep any existing not provided
      byId.set(key, { ...byId.get(key), ...p });
    }
    const merged = Array.from(byId.values());

    // Sync back to user doc (best effort)
    updateDoc(doc(db, 'users', user.uid), { purchases: merged }).catch(() => {});
    return merged;
  });

  // Remove any pending ids that just got approved
  setPendingPlanIds((prev) =>
    prev.filter(id => !incoming.some(p => String(p.planId) === String(id)))
  );

  // Toast only for newly seen planIds during this session
  const newlyApproved = incoming
    .map(p => p.planId)
    .filter(id => !approvedPlanIdsRef.current.has(String(id)));

  if (newlyApproved.length > 0) {
    newlyApproved.forEach(id => approvedPlanIdsRef.current.add(String(id)));
    showToast(`✅ Your Plan(s) ${newlyApproved.join(', ')} have been approved!`, 'success');
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

  return () => {
  unsubscribe(); // user listener
  unsubscribePurchases(); // approved plans listener
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
  const messages = ['Invest ✓', 'Earn ✓', 'Reward ✓'];
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
    // ✅ parse amount once and validate as a number
    const amt = Number(withdrawAmount);

    if (!userData?.walletAddress) {
      showToast("Add your USDT (BEP-20) wallet address first.", "warning");
      setShowAddressModal(true);
      return;
    }

    if (!Number.isFinite(amt) || amt <= 0) {
      showToast("Please enter a valid amount", "error");
      return;
    }

    // ✅ require a saved wallet address
    if (!userData?.walletAddress) {
      showToast("Add your USDT (BEP-20) wallet address first.", "warning");
      setShowAddressModal(true);
      return;
    }

    const currentWallet = Number(userData?.wallet || 0);
    if (amt > currentWallet) {
      showToast("Insufficient balance", "error");
      return;
    }

    try {
      setLoading(true);
      const oldBalance = currentWallet;
      const newBalance = oldBalance - amt;

      // Create withdraw request document
      await addDoc(collection(db, "withdrawRequests"), {
        uid: user.uid,
        userName: userData.name || "Unknown",
        oldBalance,
        amount: amt,                // ✅ store number
        newBalance,
        walletAddress: userData.walletAddress || "",
        status: "pending",
        createdAt: serverTimestamp()
      });

      // Update wallet immediately + push to user's withdrawHistory
      await updateDoc(doc(db, 'users', user.uid), {
        wallet: newBalance,
        withdrawHistory: arrayUnion({
          amount: amt,             // ✅ store number
          status: 'Pending',
          time: new Date().toISOString()
        })
      });

      // Update local state
      setUserData(prev => ({ ...prev, wallet: newBalance }));
      setWithdrawAmount("");       // ✅ reset ONCE

      setAlertModal({
        show: true,
        message: "✅ Your withdrawal request has been sent and will be approved within 24 hours.",
        isAnnouncement: false,
        timestamp: Date.now().toString()
      });
    } catch (error) {
      console.error("Error sending withdraw request:", error);
      showToast("Failed to send request", "error");
    } finally {
      setLoading(false);
    }
  };



 const handleBuyWithWallet = async () => {
  if (!selectedPlan || wallet < selectedPlan.price) {
    showToast("Insufficient balance to buy this plan", "error");
    return;
  }

  if (purchases.some(p => p.planId === selectedPlan.id)) {
    showToast("❌ You already purchased this plan.", "error");
    return;
  }
  setLoading(true);

  const updatedWallet = wallet - selectedPlan.price;

  const luckyDrawEnd = Date.now() + (selectedPlan.days * 24 * 60 * 60 * 1000);

  const newPurchase = {
    uid: user.uid,
    userName: (userData?.name || user?.displayName || user?.email || ''),
    planId: selectedPlan.id,
    price: selectedPlan.price, // 🆕 store price directly
    days: selectedPlan.days,   // optional
    reward: selectedPlan.reward, // optional
    approvedAt: serverTimestamp(),
    status: 'approved',
    expiresAt: luckyDrawEnd // 🆕 store expiry timestamp
  };


  // ✅ 1. Update user's wallet and purchases
  const updatedPurchases = [
    ...purchases,
    { planId: selectedPlan.id, status: 'approved', purchasedAt: Date.now() }
  ];

  await updateDoc(doc(db, 'users', user.uid), {
    wallet: updatedWallet,
    purchases: updatedPurchases
  });

  // ✅ 2. Also add to purchases collection for persistence
  await addDoc(collection(db, 'purchases'), newPurchase);

  // ✅ 3. Update local state
  setWallet(updatedWallet);
  setPurchases(updatedPurchases);

  setShowBuyModal(false);
  setSelectedPlan(null);
  setLoading(false);
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

// 📌 Cloudinary Upload Helper (uses Vite env vars)
const uploadToCloudinary = async (file) => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const unsignedPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !unsignedPreset) throw new Error("Cloudinary env vars missing");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", unsignedPreset);
  formData.append("cloud_name", cloudName);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Failed to upload image to Cloudinary");
  const data = await res.json();
  return data.secure_url;
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
    userName: (userData?.name || user?.displayName || user?.email || ''),
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
  const addr = (newAddress || "").trim();

  // ✅ strict BEP-20 (EVM) address check: 0x + 40 hex chars
  const isBep20 = /^0x[a-fA-F0-9]{40}$/.test(addr);
  if (!isBep20) {
    showToast("❌ Please enter a valid USDT (BEP-20) address (0x + 40 hex).", "error");
    return;
  }

  try {
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { walletAddress: addr });

    setWithdrawalAddress(addr);
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
  { id: 1, price: 10, reward: 30 },
  { id: 2, price: 20, reward: 60 },
  { id: 3, price: 30, reward: 90 },
  { id: 4, price: 50, reward: 150 },
  { id: 5, price: 70, reward: 210 },
  { id: 6, price: 90, reward: 270 },
  { id: 7, price: 100, reward: 300 },
  { id: 8, price: 150, reward: 450 },
  { id: 9, price: 200, reward: 600 },
  { id: 10, price: 250, reward: 750 },
];
const [purchasedPools, setPurchasedPools] = useState([]);
const [showPools, setShowPools] = useState(false);

const handleBuyPool = async (pool) => {
  if (!user) return;

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      showToast("User not found in database.", "error");

      return;
    }

    const userDataFromDb = userSnap.data();
    const walletBalance = Number(userDataFromDb.wallet || 0);

    if (walletBalance < pool.price) {
      showToast("❌ You don't have enough balance to buy this pool. Please deposit first.", "error");
      return;
    }

    // Deduct balance
    const newBalance = walletBalance - pool.price;

    // Add to user's purchases array
    const updatedPurchases = [
      ...(userDataFromDb.purchases || []),
      {
        planId: `pool_${pool.id}`,
        price: pool.price,
        reward: pool.reward,
        purchasedAt: Date.now()
      }
    ];

    // 1️⃣ Update user document
    await updateDoc(userRef, {
      wallet: newBalance,
      purchases: updatedPurchases
    });

    // 2️⃣ Add entry to purchases collection (so it persists like other plans)
    await addDoc(collection(db, "purchases"), {
      uid: user.uid,
      userName: userDataFromDb.name || "Unknown",
      email: userDataFromDb.email || "",
      planId: `pool_${pool.id}`,
      type: "pool",
      price: pool.price,
      reward: pool.reward,
      approvedAt: serverTimestamp()
    });

    // 3️⃣ Add user to pool_X/users subcollection
    await setDoc(doc(db, "pools", `pool_${pool.id}`, "users", user.uid), {
      uid: user.uid,
      userName: userDataFromDb.name || "Unknown",
      email: userDataFromDb.email || "",
      joinedAt: serverTimestamp()
    });

    // 4️⃣ Update local state instantly
    setWallet(newBalance);
    setPurchases(updatedPurchases);
    setPurchasedPools(prev => [...prev, pool.id]);
    showToast(`✅ Your Pool ${pool.id} have been Purchased!`, 'success');
  } catch (error) {
    console.error("Error buying pool:", error);
    showToast("❌ Error buying pool. Please try again.", "error");
  }
};



const planNameMap = {
  1: "Silver Plan",
  2: "Gold Plan",
  3: "Diamond Plan"
};


  return (
    <div className="container">
      <div className="header" style={{display:'flex'}}>
        <div className="top-buttons">
          <button className="mainBtn" style={{borderRadius:'50px'}} onClick={() => setShowProfile(true)}>👤</button>
           <h1 className="welcome">
           Welcome, <span style={{ color: '#ffd700' , fontSize: '25px' }}>{user.name}</span>
        </h1>
           <img src={Logo} style={{width:'90px', justifySelf:'center', display:'flex', justifyContent:'center', alignItems:'center'}} />
        </div>
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
        
        <div className="box" style={{display:'flex', background:'#324674ff'}}>
          
          <div style={{width:'50%'}}>
            <h4>Wallet balance</h4>
            <p className="wallet">${(Number(wallet) || 0).toFixed(2)}</p>
          </div>
          
          <div style={{display: 'grid', gap: '20px', marginTop: '8px', width:'50%', height:'30%' }}>
            <button className="mainBtn" style={{width:'90%'}} onClick={() => setShowDepositModal(true)}>💱 Deposit in</button>
            <button className="mainBtn" style={{width:'90%'}} onClick={() => setShowWithdrawModal(true)}>📤 Cash out</button>
          </div>
        </div>
          

      </div>
          <div  style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', rowGap:'85%' }}>
            <button className="mainBtn" style={{height:'250%',background:'#141414', border:'1px dashed #324674ff', justifyContent:'center', borderRadius:'10px' }} onClick={() => setShowPurchases(true)}>🛒 Purchases</button>
            <button className="mainBtn" style={{height:'250%',background:'#141414', border:'1px dashed #324674ff', justifyContent:'center', borderRadius:'10px' }} onClick={() => { setShowHistory(true); }}>📜 History</button>
            <button className="mainBtn" style={{height:'250%',background:'#141414', border:'1px dashed #324674ff', justifyContent:'center', borderRadius:'10px' }} onClick={() => setShowAddressModal(true)}>
              {withdrawalAddress ? '✏️ Wallet' : '➕ Add Wallet'}
            </button>
            <button className="mainBtn" style={{height:'250%',background:'#141414', border:'1px dashed #324674ff', justifyContent:'center', borderRadius:'10px' }} onClick={() => setShowPools(true)}>🏆 Pools</button>
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
      <br/>
      <br/>
      <h2 className="animated-heading">
         Buy our exclusive plans <span className="typing">{animatedText}</span></h2>
      <br/> 
      <div className="sliderContainer">
        {plans.map((plan) => (
        <div
          key={plan.id}
          className={`planCard plan-${plan.id}`}
          onClick={() => {
            if (pendingPlanIds.includes(plan.id)) {
              showToast(`⏳ You already requested to buy Plan ${plan.id}... Will be approved within 12 hours.⏰.`, 'warning');
              return;
            }
            const activePurchase = purchases.find(p => p.planId === plan.id);
            if (activePurchase) {
              if (!activePurchase.expiresAt || Date.now() < activePurchase.expiresAt) {
                showToast(`⏳ You already purchased Plan ${plan.id}. Wait for the lucky draw to end.`, 'warning');
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
     
          <p style={{textAlign:'center' , fontSize:'0.6rem'}}>© 2025 Lucky Paisa. All rights reserved.</p> 
      
          
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
              min="1"
              step="0.01"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />

            <button className="primaryBtn" onClick={handleWithdrawRequest} disabled={loading}>{loading ? 'Sending...' : 'Withdraw'}</button>
            <button className="cancelBtn" onClick={() => setShowWithdrawModal(false)}>Cancel</button>
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
              autoComplete="off"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
            />
            <button className="primaryBtn" onClick={handleSaveAddress}disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
            <button className="cancelBtn" onClick={() => setShowAddressModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfile && (
        <div className="modalOverlay" onClick={() => setShowProfile(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowProfile(false)} className="cancelBtn" style={{ marginLeft:'85%' }}>X</button>
            <h3>👤 Profile Info</h3>
            <p><strong>Name:</strong> {userData?.name || 'N/A'}</p>
            <p><strong>Email:</strong> {userData?.email || 'N/A'}</p>
            <p><strong>Phone:</strong> {userData?.phone || 'N/A'}</p>
            <p><strong>Wallet Address:</strong> {userData?.walletAddress || 'N/A'}</p>
            <br/>
            <button className="logoutBtn" onClick={handleLogout} disabled={loading}>{loading ? 'Bye...' : '🚪 Logout'}</button>  
            <br/>

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
                        {planNameMap[purchase.planId] || ` ${purchase.planId}`}
                      </h3>

                      <p className="purchase-date"><span className="status-approved"> Purchased</span></p>
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

            {depositHistory.map((item, index) => (
              <div key={`dep-${index}`} style={{ color: 'limegreen' }}>
                💰 Deposit — ${item.amount} ({item.status}) — {new Date(item.time).toLocaleString()}
              </div>
            ))}

            {withdrawHistory.map((item, index) => (
              <div key={`with-${index}`} style={{ color: 'red' }}>
                💸 Withdrawal — ${item.amount} ({item.status}) — {new Date(item.time).toLocaleString()}
              </div>
            ))}

            {planWins.map((item, index) => (
              <div key={`plan-${index}`} style={{ color: 'white' }}>
                🏆 Won {item.planName} — ${item.amount} — {new Date(item.time).toLocaleString()}
              </div>
            ))}

            {poolWins.map((item, index) => (
              <div key={`pool-${index}`} style={{ color: 'white' }}>
                🏆 Won {item.poolName} — ${item.amount} — {new Date(item.time).toLocaleString()}
              </div>
            ))}
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
            <p>USDT (BEP-20) Wallet address</p>
            <div className="addressBox">
              <span>0x811e9ee845dabe38ac1d87595d646176f857e36a</span>
              <button onClick={() => {
                navigator.clipboard.writeText('0x811e9ee845dabe38ac1d87595d646176f857e36a');
                showToast("Copied!", "success");
              }}>📋 Copy</button>
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
            <div style={{ display: 'grid', gap: '08px' }}>
              {pools.map(pool => (
                <div key={pool.id} style={{ border: '1px solid #666', padding: '10px', borderRadius: '8px', background: '#2c2f48', display:'flex' }}>
                  <p><b>Pool  {pool.id}</b> &nbsp; - &nbsp; Price: ${pool.price} &nbsp; - &nbsp; Reward: ${pool.reward}</p>
                    {purchasedPools.includes(pool.id) ? (
                      <p style={{color: 'lime'}}>&nbsp;&nbsp;Purchased</p>
                    ) : (
                      <button className="mainBtn" style={{marginLeft: 'auto'}} onClick={() => handleBuyPool(pool)} disabled={loading}>{loading ? 'Buying...' : 'Buy'}</button>
                    )}
                    <br/>
                    
                </div>
                
              ))}
                <br/>
                <br/>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Home;
