import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// ---------------- FIREBASE ----------------
const firebaseConfig = {
    apiKey: "AIzaSyCzjkcQFSYlJw-BKS7RatdXdCAxkh_9O9U",
    authDomain: "nallundaifirebase.firebaseapp.com",
    projectId: "nallundaifirebase",
    storageBucket: "nallundaifirebase.firebasestorage.app",
    messagingSenderId: "324623937766",
    appId: "1:324623937766:web:acde0ebc0237276fbe8b27",
    measurementId: "G-XS0784L10C"
};

const app = initializeApp(firebaseConfig);
getAnalytics(app);
const db = getFirestore(app);

// ---------------- DATA ----------------
const passwords = {
    "Pääministeri": "7986", "Poliisi": "8234", "Kierrättäjä": "3456",
    "Puolustusministeri": "9765", "Rajavartija": "9088", "Kirjastonhoitaja": "3537",
    "Pankkiiri": "8474", "Lääkäri": "9967", "Valtio": "1111",
    "VEPOHO-YHTYMÄ": "1234", "OSARYHTYMÄ": "5678"
};

const defaultBalances = {
    "Pääministeri": 50000, "Puolustusministeri": 40000, "Pankkiiri": 30000,
    "Poliisi": 20000, "Lääkäri": 20000, "Kierrättäjä": 15000,
    "Kirjastonhoitaja": 10000, "Rajavartija": 20000, "Valtio": 20951000,
    "VEPOHO-YHTYMÄ": 50000, "OSARYHTYMÄ": 50000
};

let currentRole = "";

// ---------------- INIT ----------------
window.onload = async function () {
    let savedRole = sessionStorage.getItem("loggedInRole");
    let savedPage = sessionStorage.getItem("activePage") || "home";
    
    if (savedRole) {
        currentRole = savedRole;
        
        document.getElementById("loginPage").style.display = "none";
        document.getElementById("dashboard").style.display = "block";
        
        const bal = await getBalance(currentRole);
        document.getElementById("userBalance").textContent = parseInt(bal).toLocaleString("fi-FI");
        
        show(savedPage);
        showNotifications();
        renderSuggestions();
        renderLaws(); // <--- LISÄTTY: Lait latautuvat heti sisäänkirjautumisen jälkeen
    }
};

// ---------------- BALANCE ---------------
async function getUserDoc(role) {
    const ref = doc(db, "users", role);
    return await getDoc(ref);
}

// Eurojen saldo
async function getBalance(role) {
    const snap = await getUserDoc(role);
    // Käytetään ?? (nullish coalescing) operaattoria, joka on tyylikkäämpi
    return snap.exists() ? (snap.data().balance ?? 0) : (defaultBalances[role] ?? 0);
}

async function setBalance(role, amount) {
    await setDoc(doc(db, "users", role), { balance: amount }, { merge: true });
}

// Digikolikot
async function getCoins(role) {
    const snap = await getUserDoc(role);
    if (!snap.exists()) return role === "Valtio" ? 245 : 0;
    
    const coins = snap.data().coins;
    return coins !== undefined ? coins : (role === "Valtio" ? 245 : 0);
}

// TÄMÄ PUUTTUI: Kolikoiden tallennus
async function setCoins(role, amount) {
    await setDoc(doc(db, "users", role), { coins: amount }, { merge: true });
}
// ---------------- LOGIN ----------------
function login() {
    const role = document.getElementById("role").value;
    const pass = document.getElementById("password").value;
    if (passwords[role] !== pass) return alert("Väärä salasana!");
    sessionStorage.setItem("loggedInRole", role);
    location.reload();
}

// ---------------- NAV ----------------
function show(pageId) {
    sessionStorage.setItem("activePage", pageId);
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.getElementById(pageId).classList.add("active");
    
 
    if (pageId === "shopping") renderShop();
    if (pageId === "admin-panel") showAdminPanel();
    if (pageId === "laws") renderLaws();
}

// ---------------- TRANSAKTIOT ----------------
async function processTransaction(multiplier) {
    const reason = document.getElementById("transactionReason").value;
    const target = document.getElementById("targetRole").value;
    const amount = parseInt(document.getElementById("globalAmount").value);
    if (!reason || isNaN(amount) || amount <= 0) return alert("Täytä perustelu ja summa!");
    let targetBal = await getBalance(target);
    if (multiplier === 1) {
        targetBal += amount;
        await setBalance(target, targetBal);
        alert(`+${amount}€ → ${target}`);
    } else {
        if (targetBal < amount) return alert("Ei tarpeeksi varoja!");
        targetBal -= amount;
        await setBalance(target, targetBal);
        alert(`-${amount}€ → ${target}`);
    }
    location.reload();
}

// ---------------- SHOP ----------------
async function addProduct() {
    if (currentRole !== "Valtio") return alert("Vain Valtio voi lisätä tuotteita!");
    const name = document.getElementById("itemName").value;
    const desc = document.getElementById("itemDesc").value;
    const price = parseInt(document.getElementById("itemPrice").value);
    const cat = document.getElementById("itemCategory").value;
    if (!name || !desc || isNaN(price) || !cat) return alert("Täytä kaikki kentät!");
    await addDoc(collection(db, "shopItems"), { name, desc, price, category: cat, isSoldOut: false, createdAt: Date.now() });
    renderShop();
}

async function renderShop() {
    const container = document.getElementById("shop-items-container"); 
    if (!container) return;
    const snap = await getDocs(collection(db, "shopItems"));
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    container.innerHTML = "";
    const cats = [...new Set(items.map(i => i.category))];
    cats.forEach(cat => {
        const filtered = items.filter(i => i.category === cat);
        if (filtered.length) {
            container.innerHTML += `<h3>${cat}</h3>`;
            filtered.forEach(item => {
                container.innerHTML += `
                    <div style="padding:10px; margin:10px; background:#1e293b;">
                        <strong>${item.name}</strong> - ${item.price}€
                        <p>${item.desc}</p>
                        <button onclick="${item.isSoldOut ? '' : `buy('${item.price}','${item.name}')`}">${item.isSoldOut ? "LOPPUUNMYYTY" : "Osta"}</button>
                        ${currentRole === "Valtio" ? `
                            <button onclick="toggleSoldOut('${item.id}')">Tila</button>
                            <button onclick="editItem('${item.id}')">Muokkaa</button>
                            <button onclick="deleteItem('${item.id}')" style="background:red;">Poista</button>
                        ` : ""}
                    </div>`;
            });
        }
    });
}

async function toggleSoldOut(id) {
    const ref = doc(db, "shopItems", id);
    const snap = await getDoc(ref);
    await updateDoc(ref, { isSoldOut: !snap.data().isSoldOut });
    renderShop();
}

async function editItem(id) {
    const ref = doc(db, "shopItems", id);
    const snap = await getDoc(ref);
    const item = snap.data();
    const newName = prompt("Uusi nimi:", item.name);
    const newPrice = prompt("Uusi hinta:", item.price);
    await updateDoc(ref, { name: newName || item.name, price: parseInt(newPrice) || item.price });
    renderShop();
}

async function deleteItem(id) {
    if (!confirm("Poistetaanko tuote?")) return;
    await deleteDoc(doc(db, "shopItems", id));
    renderShop();
}

async function buy(price, name) {
    await addDoc(collection(db, "pendingRequests"), { role: currentRole, item: name, price: price, createdAt: Date.now() });
    alert("Ostopyyntö lähetetty valtiolle!");
}

   
    
    // Haetaan pörssihinta
    const hintaSnap = await getDoc(doc(db, "digikolikko", "hintaData"));
 // Tarkistetaan ensin, löytyykö snapshot ja onko se olemassa
if (hintaSnap && hintaSnap.exists()) {
    const pörssihinta = hintaSnap.data().currentPrice;
    console.log("Pörssihinta ladattu:", pörssihinta);
} else {
    console.warn("Virhe: hintaSnap on tyhjä tai dokumenttia ei löytynyt.");
  
    const pörssihinta = 0; 
}
    // Haetaan kaikki käyttäjät
    const usersSnap = await getDocs(collection(db, "users"));
    usersSnap.forEach((uDoc) => {
        const u = uDoc.data();
        const sellerRole = uDoc.id;
        
        // Näytetään pelaajat joilla on kolikoita, mutta ei Valtiota eikä itseäsi
        if (sellerRole !== currentRole && sellerRole !== "Valtio" && u.coins > 0) {
            container.innerHTML += `
                <div style="background:#1e293b; padding:10px; margin-bottom:5px; border-radius:5px; display:flex; justify-content:space-between;">
                    <span>${sellerRole} (${u.coins} kpl)</span>
                    <button onclick="buyCoinFromPlayer('${sellerRole}', ${pörssihinta})">Osta (${pörssihinta}€)</button>
                </div>`;
        }
    });
// ---------------- OSTOTAPAHTUMIEN HALLINTA ----------------
window.approveShopReq = async function(docId) {
    const reqRef = doc(db, "pendingRequests", docId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) return;
    const req = reqSnap.data();

    if (req.type === 'buy_coin') {
        // --- KOLIKKOKAUPPA (P2P) ---
        let bCoins = await getCoins(req.buyer);
        let sCoins = await getCoins(req.seller);
        let bBal = await getBalance(req.buyer);
        let sBal = await getBalance(req.seller);

        await setCoins(req.buyer, bCoins + 1);
        await setCoins(req.seller, sCoins - 1);
        await setBalance(req.buyer, bBal - req.price);
        await setBalance(req.seller, sBal + req.price);
        
        await updatePriceLogic('buy');
        alert("Kolikkokauppa hyväksytty!");
        
    } else {
        // --- VALTION TUOTEKAUPPA ---
        let buyerBal = await getBalance(req.role);
        let valtioBal = await getBalance("Valtio");
        await setBalance(req.role, buyerBal - parseInt(req.price));
        await setBalance("Valtio", valtioBal + parseInt(req.price));

        const notifRef = doc(db, "notifications", req.role);
        const notifSnap = await getDoc(notifRef);
        let notifs = notifSnap.exists() ? notifSnap.data().list : [];
        notifs.push("✅ OSTOS HYVÄKSYTTY: " + req.item + " (-" + req.price + "€)");
        await setDoc(notifRef, { list: notifs }, { merge: true });
    }

    await deleteDoc(reqRef);
    showAdminPanel();
};

window.rejectShopReq = async function(docId) {
    const reqRef = doc(db, "pendingRequests", docId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) return;
    const req = reqSnap.data();

    if (req.type === 'buy_coin') {
        // --- KOLIKKOKAUPPA (Pelaajalta pelaajalle) ---
        // Jos hylätään kolikkokauppa, voidaan lähettää ilmoitus ostajalle
        const notifRef = doc(db, "notifications", req.buyer);
        const notifSnap = await getDoc(notifRef);
        let notifs = notifSnap.exists() ? notifSnap.data().list : [];
        notifs.push("❌ KOLIKKOKAUPPA HYLÄTTY: Myyjä perui kaupan.");
        await setDoc(notifRef, { list: notifs }, { merge: true });
        
    } else {
        // --- PERINTEINEN VALTION KAUPPA ---
        const notifRef = doc(db, "notifications", req.role);
        const notifSnap = await getDoc(notifRef);
        let notifs = notifSnap.exists() ? notifSnap.data().list : [];
        notifs.push("❌ OSTOS HYLÄTTY: " + req.item);
        await setDoc(notifRef, { list: notifs }, { merge: true });
    }

    await deleteDoc(reqRef);
    showAdminPanel(); // Päivittää listan näkymästä
};

async function approveTransfer(docId) {
    const reqRef = doc(db, "moneyRequests", docId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) return;
    const req = reqSnap.data();
    let fromBal = await getBalance(req.from);
    let toBal = await getBalance(req.to);
    await setBalance(req.from, fromBal - parseInt(req.amount));
    await setBalance(req.to, toBal + parseInt(req.amount));
    await deleteDoc(reqRef);
    showAdminPanel();
}

async function rejectTransfer(docId) {
    await deleteDoc(doc(db, "moneyRequests", docId));
    showAdminPanel();
}

async function submitTransferRequest() {
    const to = document.getElementById("transferTo").value;
    const amount = document.getElementById("transferAmount").value;
    const reason = document.getElementById("transferReason").value;
    if (!to || !amount || !reason) return alert("Täytä kaikki kentät!");
    await addDoc(collection(db, "moneyRequests"), { from: currentRole, to, amount: parseInt(amount), reason, createdAt: Date.now() });
    alert("Siirtopyyntö lähetetty!");
}

// ---------------- ADMIN PANEL ----------------
async function showAdminPanel() {
    // Poistettiin "Valtio-only" rajoitus, jotta myyjät näkevät omat kauppansa
    document.getElementById("admin-content").style.display = "block";
    
    // Saldot näytetään vain Valtiolle (tai jos haluat, voit poistaa tämän rajoituksen)
    if (currentRole === "Valtio") {
        const balC = document.getElementById("all-balances");
        balC.innerHTML = "<h3>Saldot:</h3>";
        for (let r in passwords) {
            const b = await getBalance(r);
            balC.innerHTML += `<div>${r}: ${b.toLocaleString()}€</div>`;
        }
        
        const trans = await getDocs(collection(db, "moneyRequests"));
        const transC = document.getElementById("money-request-list");
        transC.innerHTML = "<h4>Siirtopyynnöt</h4>";
        trans.docs.forEach(d => {
            const r = d.data();
            transC.innerHTML += `<div>${r.from} → ${r.to}: ${r.amount}€ <button onclick="approveTransfer('${d.id}')">✅</button><button onclick="rejectTransfer('${d.id}')">❌</button></div>`;
        });
    }

    // --- OSTOPYYNNÖT (Kaikki näkevät omansa) ---
    const shop = await getDocs(collection(db, "pendingRequests"));
    const shopC = document.getElementById("request-list");
    shopC.innerHTML = "<h4>Ostopyynnöt</h4>";
    
    shop.docs.forEach(d => {
        const r = d.data();
        
        // Näytetään vain:
        // 1. Valtiolle kaikki
        // 2. Myyjälle ne, joissa hän on myyjänä (kolikkokauppa)
        // 3. Valtiolle ne, joissa on "role" (perinteinen kauppa)
        const isMySale = (r.seller === currentRole);
        const isValtioSale = (currentRole === "Valtio" && r.role);
        
        if (isMySale || isValtioSale) {
            const displayLabel = r.type === 'buy_coin' ? 
                `Digikolikko (Myyjä: ${r.seller})` : 
                `${r.role}: ${r.item}`;
                
            shopC.innerHTML += `
                <div>
                    ${displayLabel} (${r.price}€) 
                    <button onclick="approveShopReq('${d.id}')">✅</button>
                    <button onclick="rejectShopReq('${d.id}')">❌</button>
                </div>`;
        }
    });
}
// ---------------- NOTIFICATIONS ----------------
async function showNotifications() {
    const container = document.getElementById("all-notifications");
    if (!container) return;
    
    const ref = doc(db, "notifications", currentRole);
    const snap = await getDoc(ref);
    const msgs = snap.exists() ? snap.data().list : [];
    
    container.innerHTML = "<h4>Ilmoitukset:</h4>";
    
    // Listataan vain viestit ilman OK-nappia
    msgs.forEach((m) => { 
        container.innerHTML += `
            <div style="background:#1e293b; padding:10px; margin:5px; border-radius:5px;">
                ${m}
            </div>`; 
    });
}

async function submitSuggestion() {
    const text = document.getElementById("devSuggestion").value;
    if (!text) return alert("Kirjoita idea!");
    // Lisätään tyhjä vastaus ja rooli tietokantaan
    await addDoc(collection(db, "devSuggestions"), { 
        from: currentRole, 
        text: text, 
        reply: "" 
    });
    alert("Lähetetty!");
    document.getElementById("devSuggestion").value = "";
    renderSuggestions();
}

async function renderSuggestions() {
    const container = document.getElementById("suggestion-responses");
    if (!container) return;
    
    const snap = await getDocs(collection(db, "devSuggestions"));
    container.innerHTML = "<h4>Ideat ja vastaukset:</h4>";
    
    snap.docs.forEach(d => {
        const s = d.data();
        const id = d.id;
        let isAdmin = (currentRole === "Valtio");

        container.innerHTML += `
        <div style="background: #2d3748; padding: 15px; margin-bottom: 15px; border-radius: 8px;">
            <p><strong>${s.from}</strong>: ${s.text}</p>
            ${s.reply ? `<p style="color: #3b82f6;"><em>Valtion vastaus: ${s.reply}</em></p>` : ""}
            
            ${isAdmin ? `
                <div id="admin-tools-${id}">
                    <input type="text" id="reply-input-${id}" placeholder="Vastaus..." style="color:black;">
                    <button onclick="sendReply('${id}')">Lähetä</button>
                    <button onclick="deleteSuggestion('${id}')" style="background: red; color: white;">Poista</button>
                </div>
            ` : ""}
        </div>`;
    });
}

// Apufunktiot vastauksille ja poistolle
window.sendReply = async function(id) {
    let replyText = document.getElementById(`reply-input-${id}`).value;
    if (!replyText) return alert("Kirjoita vastaus!");
    await updateDoc(doc(db, "devSuggestions", id), { reply: replyText });
    renderSuggestions();
};

window.deleteSuggestion = async function(id) {
    if (!confirm("Poistetaanko idea?")) return;
    await deleteDoc(doc(db, "devSuggestions", id));
    renderSuggestions();
};
async function addLaw() {
    if (currentRole !== "Valtio") return alert("Vain Valtio voi lisätä lakeja!");
    const text = document.getElementById("lawText").value;
    if (!text) return alert("Kirjoita laki ensin!");
    await addDoc(collection(db, "laws"), { text: text, createdAt: Date.now() });
    alert("Laki julkaistu!");
    document.getElementById("lawText").value = "";
    renderLaws();
}

async function renderLaws() {
    const container = document.getElementById("laws-container");
    if (!container) return;
    const snap = await getDocs(collection(db, "laws"));
    container.innerHTML = "<h4>Voimassa olevat lait:</h4>";
    snap.docs.forEach(d => {
        const l = d.data();
        container.innerHTML += `
            <div style="background: #2d3748; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 5px solid #ecc94b;">
                <p style="margin:0;">${l.text}</p>
                ${currentRole === "Valtio" ? `<button onclick="deleteLaw('${d.id}')" style="margin-top: 10px; background: #c53030; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Poista laki</button>` : ""}
            </div>`;
    });
}

window.deleteLaw = async function(id) {
    if (!confirm("Haluatko varmasti poistaa tämän lain?")) return;
    await deleteDoc(doc(db, "laws", id));
    renderLaws();
};
// ---------------- DIGIKOLIKKO-GRAAFI ----------------
let digikolikkoChart;

window.initDigikolikkoChart = function() {
    const canvas = document.getElementById('digikolikkoChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    digikolikkoChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Alku'], 
            datasets: [{
                label: 'Digikolikko (€)',
                data: [500],
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
};

window.updateDigikolikkoPrice = function(newPrice) {
    if (!digikolikkoChart) return;
    
    const dataSet = digikolikkoChart.data.datasets[0].data;
    const roundedPrice = Math.round(newPrice);

    if (dataSet[dataSet.length - 1] === roundedPrice) return;

    dataSet.push(roundedPrice);
    digikolikkoChart.data.labels.push(''); 
    
    if (dataSet.length > 20) {
        dataSet.shift();
        digikolikkoChart.data.labels.shift();
    }
    
    digikolikkoChart.update();
};

// 1. TÄMÄ FUNKTIO HOITAA HINNANMUUTOKSEN PROSENTTEINA
window.updatePriceLogic = async function(type) { // type: 'buy' tai 'sell'
    const hintaRef = doc(db, "digikolikko", "hintaData");
    const hintaSnap = await getDoc(hintaRef);
    let current = hintaSnap.data().currentPrice;
    
    // Osto (+9%) tai Myynti (-8%)
    let multiplier = (type === 'buy') ? 1.09 : 0.92;
    let newPrice = Math.round(current * multiplier);
    
    await setDoc(hintaRef, { currentPrice: newPrice }, { merge: true });
};

// 2. MANUAALINEN PÄIVITYS
window.manuallyUpdatePrice = async function() {
    const input = document.getElementById("adminManualPrice");
    const newPrice = parseInt(input.value);
    if (isNaN(newPrice)) return alert("Syötä kelvollinen numero!");

    await setDoc(doc(db, "digikolikko", "hintaData"), { currentPrice: newPrice }, { merge: true });
    alert("Pörssikurssi päivitetty: " + newPrice + "€");
    input.value = ""; 
};

// 3. VAHTIKOIRA
onSnapshot(doc(db, "digikolikko", "hintaData"), (doc) => {
    if (doc.exists()) {
        const data = doc.data();
        if (data.currentPrice !== undefined) {
            if (!digikolikkoChart) window.initDigikolikkoChart();
            updateDigikolikkoPrice(data.currentPrice);
        }
    }
});
window.buyCoinFromPlayer = async function(sellerRole, price) {
    const bal = await getBalance(currentRole);
    if (bal < price) return alert("Ei tarpeeksi rahaa!");

    await addDoc(collection(db, "pendingRequests"), { 
        buyer: currentRole, 
        seller: sellerRole, 
        price: price, 
        type: 'buy_coin',
        status: 'pending',
        createdAt: Date.now() 
    });
    alert("Ostopyyntö lähetetty pelaajalle: " + sellerRole);
};
// ---------------- WINDOW-SIDOKSET ----------------
window.login = login;
window.show = show;
window.processTransaction = processTransaction;
window.addProduct = addProduct;
window.renderShop = renderShop;
window.toggleSoldOut = toggleSoldOut;
window.editItem = editItem;
window.deleteItem = deleteItem;
window.buy = buy;
window.submitTransferRequest = submitTransferRequest;
window.showAdminPanel = showAdminPanel;
window.showNotifications = showNotifications;
window.submitSuggestion = submitSuggestion;
window.renderSuggestions = renderSuggestions;
window.approveShopReq = approveShopReq;
window.rejectShopReq = rejectShopReq;
window.approveTransfer = approveTransfer;
window.rejectTransfer = rejectTransfer;
window.addLaw = addLaw;
window.renderLaws = renderLaws;
window.deleteLaw = deleteLaw;
window.updateDigikolikkoPrice = updateDigikolikkoPrice;
