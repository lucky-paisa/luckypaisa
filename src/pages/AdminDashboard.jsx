import React, { useState, useEffect } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import {collection, query, where, getDocs, arrayUnion, getDoc, orderBy, updateDoc, addDoc, doc, deleteDoc, increment, setDoc, onSnapshot, Timestamp, serverTimestamp} from 'firebase/firestore';
import './styles/AdminDashboard.css';
import { useNavigate } from 'react-router-dom';

// Add after your existing imports
const poolsConfig = [
  { id: 1, price: 10, reward: 30 },
  { id: 2, price: 20, reward: 60 },
  { id: 3, price: 30, reward: 90 },
  { id: 4, price: 50, reward: 150 },
  { id: 5, price: 70, reward: 210 },
  { id: 6, price: 90, reward: 270 },
  { id: 7, price: 100, reward: 300 },
  { id: 8, price: 150, reward: 450 },
  { id: 9, price: 200, reward: 600 },
  { id: 10, price: 250, reward: 750 }
];


const AdminDashboard = () => {
  const navigate = useNavigate();
  const [adminEmail, setAdminEmail] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [approvedPlans, setApprovedPlans] = useState([]);
  const [showApprovedModal, setShowApprovedModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [plan1Count, setPlan1Count] = useState(0);
  const [plan2Count, setPlan2Count] = useState(0);
  const [plan3Count, setPlan3Count] = useState(0);
  // Countdown & LuckyDraw states
  const [countdowns, setCountdowns] = useState({});
  const [selectedWinner, setSelectedWinner] = useState(null);
  const [countdownFinishedPlans, setCountdownFinishedPlans] = useState({});
  const [planPrize, setPlanPrize] = useState(null);
  // Deposit / Withdraw requests
  const [depositRequests, setDepositRequests] = useState([]);
  const [withdrawRequests, setWithdrawRequests] = useState([]);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [poolsData, setPoolsData] = useState({});
  const [selectedPool, setSelectedPool] = useState(null);
  const [loading, setLoading] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAdminEmail(user.email);
        setLoggedIn(true);
      } else {
        setLoggedIn(false);
        setAdminEmail('');
      }
    });

    // 🔹 Real-time listener for total earnings
    const unsubscribeEarnings = onSnapshot(doc(db, "adminData", "earnings"), (docSnap) => {
      if (docSnap.exists()) {
        setTotalEarnings(docSnap.data().total || 0);
      }
    });

        fetchMemberCounts();

        // 🔴 Real-time deposits
        const unsubscribeDeposits = onSnapshot(collection(db, 'depositRequests'), (snapshot) => {
          setDepositRequests(snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          })));
        });

        // 🔴 Real-time withdrawals
        const unsubscribeWithdrawals = onSnapshot(collection(db, 'withdrawRequests'), (snapshot) => {
          setWithdrawRequests(snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          })));
        });


  // Listen for plan countdown settings
  ['plan_1', 'plan_2', 'plan_3'].forEach((planKey) => {
    const planRef = doc(db, 'planSettings', planKey);
    onSnapshot(planRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const endTime = data.startTime.toDate().getTime() + (parseInt(data.duration) * 24 * 60 * 60 * 1000);
        
        const updateCountdown = () => {
          const now = new Date().getTime();
          const distance = endTime - now;
          if (distance <= 0) {
            setCountdowns(prev => ({ ...prev, [planKey]: '00:00:00:00' }));
            setCountdownFinishedPlans(prev => ({ ...prev, [planKey]: true }));
            setPlanPrize(data.prizeAmount);
            return;
          }
          const days = Math.floor(distance / (1000 * 60 * 60 * 24));
          const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((distance % (1000 * 60)) / 1000);
          setCountdowns(prev => ({ ...prev, [planKey]: `${days}d ${hours}h ${minutes}m ${seconds}s` }));
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
      }
    });
  });

      // 🔹 Listen for pools data
    const unsubscribes = [];
    poolsConfig.forEach(pool => {
      const poolRef = collection(db, "pools", `pool_${pool.id}`, "users");
      const unsub = onSnapshot(poolRef, (snap) => {
        const users = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        setPoolsData(prev => ({
          ...prev,
          [`pool_${pool.id}`]: users
        }));
      });
      unsubscribes.push(unsub);
    });

      // ✅ Cleanup all listeners
    return () => {
      unsubscribe();                  // auth listener
      unsubscribes.forEach(u => u()); // pools listeners
      if (unsubscribeDeposits) unsubscribeDeposits();     // deposits listener
      if (unsubscribeWithdrawals) unsubscribeWithdrawals(); // withdrawals listener
    };


    return () => unsubscribe();
  }, []);

  const fetchMemberCounts = async () => {
    const snapshot = await getDocs(collection(db, 'purchases'));
    let plan1 = 0;
    let plan2 = 0;
    let plan3 = 0;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.status === 'approved') {
        if (data.planId === 1) plan1++;
        else if (data.planId === 2) plan2++;
        else if (data.planId === 3) plan3++;
      }
    });

    setPlan1Count(plan1);
    setPlan2Count(plan2);
    setPlan3Count(plan3);
  };



  const handleLogout = async () => {
    localStorage.removeItem('isAdmin');
    await signOut(auth);
    navigate('/login');
  };

  const fetchApprovedPlans = async (planId) => {
    const snapshot = await getDocs(collection(db, 'purchases'));
    const list = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.status === 'approved' && data.planId === planId) {
        list.push({ id: docSnap.id, uid: data.uid, ...data });
      }
    });
    setApprovedPlans(list);
    setSelectedPlanId(planId);
    setShowApprovedModal(true);
  };

  const handleLuckyDraw = () => {
    if (!approvedPlans.length) return;
    const winner = approvedPlans[Math.floor(Math.random() * approvedPlans.length)];
    setSelectedWinner(winner);
  };

  const handleRedo = () => {
    setLoading(true);
    handleLuckyDraw();
    setLoading(false);
  };

const handleProceed = async () => {
  if (!selectedWinner) return;

  try {
    setLoading(true);
    const winnerUid = selectedWinner.uid; // Make sure your approvedPlans have uid field
    const planId = selectedPlanId;

    // 1️⃣ Update winner's wallet balance
    const winnerRef = doc(db, "users", winnerUid);
    const winnerSnap = await getDoc(winnerRef);
    if (winnerSnap.exists()) {
      const currentBalance = winnerSnap.data().wallet || 0;
      await updateDoc(winnerRef, {
        wallet: Number(currentBalance) + Number(planPrize)
      });
    } else {
      await setDoc(winnerRef, {
        wallet: parseFloat(planPrize),
        createdAt: Timestamp.now()
      });
    }

    // 2️⃣ Add announcements & remove plan from user's purchases array
    for (const user of approvedPlans) {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      const updatedPurchases = (userSnap.data()?.purchases || []).filter(
        (purchase) => purchase.planId !== planId
      );

      if (user.uid === winnerUid) {
      // Winner announcement
      const winnerAnnouncement = `🏆 Congrats! ${selectedWinner.userName} won the Lucky Draw for ${getPlanName(planId)}! 🎉`;
      
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          announcement: winnerAnnouncement,
          announcementTimestamp: serverTimestamp(),
          winnerAnnouncements: arrayUnion({
            message: winnerAnnouncement,
            timestamp: new Date()
          }),
          purchases: updatedPurchases,
          // ⬅️ NEW: Add to planWins history
          planWins: arrayUnion({
            planName: getPlanName(planId),
            amount: planPrize,
            time: new Date().toISOString()
          })
        });
      } else {
        await setDoc(userRef, {
          announcement: winnerAnnouncement,
          announcementTimestamp: serverTimestamp(),
          winnerAnnouncements: [{
            message: winnerAnnouncement,
            timestamp: serverTimestamp()
          }],
          purchases: updatedPurchases,
          createdAt: Timestamp.now(),
          // ⬅️ NEW: Add to planWins history
          planWins: [{
            planName: getPlanName(planId),
            amount: planPrize,
            time: new Date().toISOString()
          }]
        });
      }
    }

    }

    // 3️⃣ Delete all purchase docs for this plan from "purchases" collection
    const purchasesRef = collection(db, "purchases");
    const purchasesQuery = query(purchasesRef, where("planId", "==", planId));
    const purchasesSnap = await getDocs(purchasesQuery);
    for (const purchaseDoc of purchasesSnap.docs) {
      await deleteDoc(purchaseDoc.ref);
    }

    // 4️⃣ Restart countdown for this plan
    const planRef = doc(db, "planSettings", `plan_${planId}`);
    const planSnap = await getDoc(planRef);
    if (planSnap.exists()) {
      await updateDoc(planRef, {
        startTime: Timestamp.now()
      });
    }

    // 5️⃣ Reset states
    setSelectedWinner(null);
    setCountdownFinishedPlans(prev => ({ ...prev, [`plan_${planId}`]: false }));
    fetchMemberCounts();

    console.log(`✅ Lucky draw finalized for plan ${planId}`);
  } catch (error) {
    console.error("Error in handleProceed:", error);
  }
  finally{
    setLoading(false);
  }
};

  const getPlanName = (planId) => {
    if (planId === 1) return 'Silver Plan';
    if (planId === 2) return 'Gold Plan';
    return 'Diamond Plan';
  };

  const handleApproveDeposit = async (request) => {
    try {
      setLoading(true);
      const userRef = doc(db, "users", request.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        alert("❌ User not found for this deposit request");
        return;
      }

      const userData = userSnap.data();
      const previousBalance = Number(userData.wallet || 0);

      // ✅ Detect first deposit by wallet balance before update
      const isFirstDeposit = previousBalance === 0;

      // ✅ Update depositor's wallet
      const newBalance = previousBalance + Number(request.amount);
      await updateDoc(userRef, {
        wallet: newBalance,
        depositHistory: arrayUnion({
          amount: request.amount,
          status: "Approved",
          time: new Date().toISOString(),
        }),
        announcement: "✅ Deposit successful!",
        announcementTimestamp: serverTimestamp(),
        alertMessage: `✅ Your deposit of $${request.amount} has been approved!`,
        alertTimestamp: serverTimestamp(),
      });

      // ✅ Update Admin Earnings
      await setDoc(
        doc(db, "adminData", "earnings"),
        { total: increment(Number(request.amount)) },
        { merge: true }
      );

      // 🎁 Referral Bonus (only if first deposit)
      if (isFirstDeposit && userData.referenceBy && userData.referenceBy !== "SELF") {
        const inviterRef = doc(db, "users", userData.referenceBy);
        const inviterSnap = await getDoc(inviterRef);

        if (inviterSnap.exists()) {
          const inviterData = inviterSnap.data();
          const inviterBalance = Number(inviterData.wallet || 0);
          const bonus = Number(request.amount) * 0.10;

          await updateDoc(inviterRef, {
            wallet: inviterBalance + bonus,
            referralBonusHistory: arrayUnion({
              fromUser: userData.uid,
              fromName: userData.name || userData.email,
              amount: bonus,
              time: new Date().toISOString(),
            }),
            alertMessage: `🎉 You received $${bonus.toFixed(
              2
            )} referral bonus from ${userData.name || userData.email}'s first deposit!`,
            alertTimestamp: serverTimestamp(),
          });

          alert(
            `${userData.name || userData.email} invitation Reward $${bonus.toFixed(
              2
            )} sent to ${inviterData.name || inviterData.email}`
          );
        }
      }

      // ✅ Remove request from depositRequests
      await deleteDoc(doc(db, "depositRequests", request.id));

      // Update local UI
      setTotalEarnings((prev) => prev + Number(request.amount));
      fetchDepositRequests();

      alert(`Deposit of $${request.amount} approved for ${userData.name || userData.email}`);
    } catch (error) {
      console.error("❌ Error in handleApproveDeposit:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepositRequests = async () => {
      const snapshot = await getDocs(collection(db, 'depositRequests'));
      setDepositRequests(snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })));
    };

  const fetchWithdrawRequests = async () => {
    const snapshot = await getDocs(collection(db, 'withdrawRequests'));
     setWithdrawRequests(snapshot.docs.map(docSnap => ({
       id: docSnap.id,
       ...docSnap.data()
     })));
   };

  const handleDropDeposit = async (request) => {
    try {
      const userRef = doc(db, 'users', request.uid);
      await updateDoc(userRef, {
          announcement: `❌ Deposit failed, payment not received!`,
          announcementTimestamp: serverTimestamp(),
          alertMessage: `❌ Deposit failed, payment not received!`,
          alertTimestamp: serverTimestamp(),
            depositHistory: arrayUnion({
            amount: request.amount,
            status: 'Pending', // rejected requests still counted as pending
            time: new Date().toISOString()
           })

        });

      await deleteDoc(doc(db, 'depositRequests', request.id));
      fetchDepositRequests();
      alert(`Deposit dropped for ${request.userName}`);
    } catch (error) {
      console.error(error);
    }
  };

  const handleApproveWithdraw = async (request) => {
    try {
      setLoading(true);
      const userRef = doc(db, 'users', request.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const currentWallet = Number(userSnap.data().wallet || 0);
        // In case you ever need to adjust wallet on approve
        const newWallet = Number(currentWallet); // currently no deduction
        await updateDoc(userRef, {
          wallet: newWallet,
          announcement: `✅ Withdraw approved, delivered to your USDT (BEP-20) wallet address: ${request.walletAddress}`,
          announcementTimestamp: serverTimestamp(),
          alertMessage: `✅ Your withdrawal request of $${request.amount} has been approved!`,
          alertTimestamp: serverTimestamp(),
          withdrawHistory: arrayUnion({
            amount: request.amount,
            status: 'Approved',
            time: new Date().toISOString()
          })

        });
         await setDoc(
          doc(db, "adminData", "earnings"),
          { total: increment(-Number(request.amount)) },
          { merge: true }
        );



      } else {
        await setDoc(userRef, {
          wallet: 0,
          announcement: `✅ Withdraw approved, delivered to your USDT (BEP-20) wallet address: ${request.walletAddress}`,
          announcementTimestamp: serverTimestamp(),
          createdAt: Timestamp.now()
        });
      }

      await deleteDoc(doc(db, 'withdrawRequests', request.id));
      // Instantly update total earnings in UI
      setTotalEarnings(prev => prev - Number(request.amount));
      fetchWithdrawRequests();
      alert(`Withdraw of $${request.amount} approved for ${request.userName}`);
    } catch (error) {
      console.error(error);
    }
    finally{
      setLoading(false);
    }
  };


 const handleDropWithdraw = async (request) => {
  try {
    setLoading(true);
    const userRef = doc(db, "users", request.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const currentWallet = Number(userSnap.data().wallet || 0);
      const returnAmount = Number(request.amount || 0);
      const newWallet = currentWallet + returnAmount; // ✅ Correct numeric addition

      await updateDoc(userRef, {
        wallet: newWallet,
        announcement: `❌ Your withdrawal request of $${request.amount} not approved, SERVER ERROR, amount returned to wallet.`,
        announcementTimestamp: serverTimestamp(),
        alertMessage: `❌ Your withdrawal request of $${request.amount} not approved, SERVER ERROR, amount returned to wallet.`,
        alertTimestamp: serverTimestamp(),
        withdrawHistory: arrayUnion({
          amount: request.amount,
          status: 'Pending', // rejected requests still counted as pending
          time: new Date().toISOString()
        })
        });
    }

    await deleteDoc(doc(db, "withdrawRequests", request.id));
    fetchWithdrawRequests();
  } catch (error) {
    console.error(error);
  }
  finally{
    setLoading(false);
  }
};


const rewardUser = async (poolId, user) => {
  try {
    const poolInfo = poolsConfig.find(p => `pool_${p.id}` === poolId);
    const rewardAmt = poolInfo?.reward || 0;

    // 1️⃣ Update user doc & remove from purchases array
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const currentData = userSnap.data();

      setLoading(true);

      // Remove any matching pool purchase
      const updatedPurchases = (currentData.purchases || []).filter(
        p => p.poolId !== poolId && `pool_${p.planId}` !== poolId
      );

      await updateDoc(userRef, {
        wallet: Number(currentData.wallet || 0) + rewardAmt,
        purchases: updatedPurchases,
        alertMessage: `🎁 You received $${rewardAmt} from ${poolId}!`,
        alertTimestamp: serverTimestamp(),
        poolWins: arrayUnion({
          poolName: poolId,
          amount: rewardAmt,
          time: new Date().toISOString()
        })
      });
    }

    // Remove from purchases collection — only match pools
    const purchasesRef = collection(db, "purchases");
    const poolQuery = query(
      purchasesRef,
      where("planId", "==", poolId),
      where("type", "==", "pool"),
      where("uid", "==", user.uid)
    );

    const poolSnap = await getDocs(poolQuery);
    for (const docSnap of poolSnap.docs) {
      await deleteDoc(docSnap.ref);
    }


    // 3️⃣ Remove from pool subcollection
    await deleteDoc(doc(db, "pools", poolId, "users", user.id));

    alert(`✅ Reward sent and ${poolId} cleared for ${user.userName}`);
  } catch (err) {
    console.error("Error rewarding user:", err);
  }
  finally{
    setLoading(false);
  }
};
const rewardAll = async (poolId) => {
  const users = poolsData[poolId] || [];
  const poolInfo = poolsConfig.find(p => `pool_${p.id}` === poolId);
  const rewardAmt = poolInfo?.reward || 0;

  for (const user of users) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const currentData = userSnap.data();

      setLoading(true);


      const updatedPurchases = (currentData.purchases || []).filter(
        p => p.poolId !== poolId && `pool_${p.planId}` !== poolId
      );

      await updateDoc(userRef, {
        wallet: Number(currentData.wallet || 0) + rewardAmt,
        purchases: updatedPurchases,
        alertMessage: `🎁 You received $${rewardAmt} from ${poolId}!`,
        alertTimestamp: serverTimestamp(),
        poolWins: arrayUnion({
          poolName: poolId,
          amount: rewardAmt,
          time: new Date().toISOString()
        })
      });
    }

    // Remove from purchases collection — only match pools
    const purchasesRef = collection(db, "purchases");
    const poolQuery = query(
      purchasesRef,
      where("planId", "==", poolId),
      where("type", "==", "pool"),
      where("uid", "==", user.uid)
    );

    const poolSnap = await getDocs(poolQuery);
    for (const docSnap of poolSnap.docs) {
      await deleteDoc(docSnap.ref);
    }


    // Remove from pool users subcollection
    await deleteDoc(doc(db, "pools", poolId, "users", user.id));
  }

  alert(`✅ Rewards sent and ${poolId} reset for all users`);
  setLoading(false);
};


  return (
    <div className="admin-dashboard">
      <header className="admin-header">

        <h1>🎉 Welcome Admin</h1>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </header>

      <div style={{
            background: "#eeeeee2f",
            padding: "8px 12px",
            borderRadius: "8px",
            fontWeight: "bold",
            textAlign: "center",
            width:"90%"
          }}>
            <label style={{ fontWeight: "bold" }}>Total Earnings</label>
            <br />
            ${totalEarnings.toFixed(2)}
            <br />
            <button
              style={{ marginTop: "5px", padding: "4px 8px", fontSize: "12px" }}
              onClick={async () => {
                await updateDoc(doc(db, "adminData", "earnings"), { total: 0 });
              }}
            >
              Reset
            </button>
          </div>

      <div className="admin-buttons">
        <button className="plan-btn" onClick={() => fetchApprovedPlans(1)}>
          Plan 1 Members ({plan1Count}) ⏳ {countdowns.plan_1 || 'Loading...'}
        </button>
        <button className="plan-btn" onClick={() => fetchApprovedPlans(2)}>
          Plan 2 Members ({plan2Count}) ⏳ {countdowns.plan_2 || 'Loading...'}
        </button>
        <button className="plan-btn" onClick={() => fetchApprovedPlans(3)}>
          Plan 3 Members ({plan3Count}) ⏳ {countdowns.plan_3 || 'Loading...'}
        </button>
        <button className="pending-btn" onClick={() => setShowDepositModal(true)}>
          Deposit Requests ({depositRequests.length})
        </button>
        <button className="pending-btn" onClick={() => setShowWithdrawModal(true)}>
          Withdraw Requests ({withdrawRequests.length})
        </button>
      </div>

      <h2 style={{ marginTop: "20px" }}>🏆 Pools Management</h2>
      
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
      
        {poolsConfig.map(pool => (
          <button
            key={pool.id}
            onClick={() => setSelectedPool(`pool_${pool.id}`)}
            style={{ padding: "10px", borderRadius: "6px" }}
          >
            Pool {pool.id} ({poolsData[`pool_${pool.id}`]?.length || 0})
          </button>
        ))}
      </div>

      {selectedPool && (
        <div style={{ marginTop: "20px" }}>
          <input
            type="text"
            placeholder="Search by name or date..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: "6px", marginBottom: "10px", width: "250px" }}
          />

          <h3>{selectedPool.toUpperCase()} Users</h3>
          <button onClick={() => rewardAll(selectedPool)} disabled={loading}>{loading ? 'Rewarding...' : 'Reward All'}</button>
          <table style={{ width: "100%", color: "#fff", borderCollapse: "collapse", marginTop: "10px"}}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Joined</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(poolsData[selectedPool] || []).filter(user => {
                  const nameMatch = user.userName?.toLowerCase().includes(searchTerm.toLowerCase());
                  const dateStr = user.joinedAt?.toDate().toLocaleDateString() || "";
                  const dateMatch = dateStr.includes(searchTerm);
                  return nameMatch || dateMatch; }).map(user => (
                <tr key={user.id}>
                  <td>{user.userName}</td>
                   <td>{user.joinedAt?.toDate().toLocaleString() || ""}</td>
                  <td>
                    <button onClick={() => rewardUser(selectedPool, user)}disabled={loading}>{loading ? 'Rewarding...' : 'Reward'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Approved Plans Modal */}
      {showApprovedModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Approved Members - Plan {selectedPlanId}</h2>
            <button onClick={() => setShowApprovedModal(false)} className="close-btn">X</button>
            {approvedPlans.length === 0 ? (
              <p>No approved members found.</p>
            ) : (
              <>
                {countdownFinishedPlans[`plan_${selectedPlanId}`] && (
                  <div style={{ marginBottom: '15px' }}>
                    <button onClick={handleLuckyDraw}>🎯 LuckyDraw</button>
                    {selectedWinner && (
                      <div>
                        <p>Winner: {selectedWinner.userName}</p>
                        <button onClick={handleProceed} disabled={loading}>{loading ? 'Loading...' : '✅ Proceed'}</button>                        
                        <button onClick={handleRedo} disabled={loading}>{loading ? 'Loading...' : '🔄 Redo'}</button>
                        
                      </div>
                    )}
                  </div>
                )}

                <div className="plan-table">
                  {approvedPlans.map((user) => (
                  <div className="plan-card" key={user.id}>
                    <p><strong>Name:</strong> {user.userName}</p>
                    <p><strong>Email:</strong> {user.email}</p>
                    <p><strong>Plan ID:</strong> {user.planId}</p>
                    <p><strong>Price:</strong> ${user.price}</p>
                    <p><strong>Status:</strong> {user.status}</p>
                  </div>
                ))}
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {showDepositModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Deposit Requests</h2>
            <button onClick={() => setShowDepositModal(false)} className="close-btn">X</button>
            {depositRequests.length === 0 ? (
              <p>No deposit requests.</p>
            ) : (
              <div className="plan-table">
                {depositRequests.map((req) => (
                  <div className="plan-card" key={req.id}>
                    <p><strong>Name:</strong> {req.userName}</p>
                    <p><strong>Email:</strong> {req.email}</p>
                    <p><strong>Amount:</strong> ${req.amount}</p>
                    <img src={req.screenshotUrl} alt="Deposit screenshot" className="plan-screenshot" />
                    <div className="plan-actions">
                      <button onClick={() => handleApproveDeposit(req)} className="approve-btn"disabled={loading}>{loading ? 'Loading...' : '✅ Approve'}</button>
                      <button onClick={() => handleDropDeposit(req)} className="drop-btn">❌ Drop</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showWithdrawModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Withdraw Requests</h2>
            <button onClick={() => setShowWithdrawModal(false)} className="close-btn">X</button>
            {withdrawRequests.length === 0 ? (
              <p>No withdraw requests.</p>
            ) : (
              <div className="plan-table">
                {withdrawRequests.map((req) => (
                  <div className="plan-card" key={req.id}>
                    <p><strong>Name:</strong> {req.userName}</p>
                    <p><strong>Old Balance:</strong> ${req.oldBalance}</p>
                    <p><strong>Withdraw Amount:</strong> ${req.amount}</p>
                    <p><strong>New Balance:</strong> ${req.newBalance}</p>
                    <p><strong>Wallet Address:</strong> {req.walletAddress}</p>
                    <div className="plan-actions">
                      <button onClick={() => handleApproveWithdraw(req)} className="approve-btn" disabled={loading}>{loading ? 'Loading...' : '✅ Approve'}</button>
                      <button onClick={() => handleDropWithdraw(req)} className="drop-btn" disabled={loading}>{loading ? 'Loading...' : '❌ Drop'}</button>
                      
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  );
};

export default AdminDashboard;