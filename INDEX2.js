import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc,  onSnapshot } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

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
    // 1. Haetaan istunnon tila
    let savedRole = sessionStorage.getItem("loggedInRole");
    let savedPage = sessionStorage.getItem("activePage") || "home";
    
    if (savedRole) {
        // Käyttäjä on kirjautunut – nyt vasta haetaan dataa
        currentRole = savedRole;
        
        document.getElementById("loginPage").style.display = "none";
        document.getElementById("dashboard").style.display = "block";
        
        // HAETAAN HINTA VAIN KIRJAUTUNEENA
        try {
            const priceSnap = await getDoc(doc(db, "digikolikko", "hintaData"));
            if (priceSnap.exists()) {
                const savedPrice = priceSnap.data().currentPrice;
                const priceDisplay = document.getElementById("current-coin-price");
                if (priceDisplay) priceDisplay.innerText = savedPrice;
            }
        } catch (e) {
            console.error("Hinnan haku epäonnistui:", e);
        }
        
        // HAETAAN MUU DATA
        const bal = await getBalance(currentRole);
        document.getElementById("userBalance").textContent = parseInt(bal).toLocaleString("fi-FI");
        
        show(savedPage);
        showNotifications();
        renderSuggestions();
        renderLaws();
    } else {
        // Jos ei kirjautunut, näytetään vain kirjautumissivu
        document.getElementById("loginPage").style.display = "flex";
        document.getElementById("dashboard").style.display = "none";
    }
};
 
// ---------------- BALANCE ----------------
async function getBalance(role) {
    const ref = doc(db, "users", role);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data().balance : defaultBalances[role];
}

async function setBalance(role, amount) {
    await setDoc(doc(db, "users", role), { balance: amount }, { merge: true });
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
    
    // Tässä nykyiset rivisi:
    if (pageId === "shopping") renderShop();
    if (pageId === "admin-panel") showAdminPanel();
    
    // LISÄÄ TÄMÄ RIVI:
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
                // Lisätty punainen reunus, jos item.isSoldOut on true
                container.innerHTML += `
                    <div style="padding:10px; margin:10px; background:#1e293b; ${item.isSoldOut ? 'border: 2px solid red;' : ''}">
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

// ---------------- OSTOTAPAHTUMIEN HALLINTA ----------------

async function approveShopReq(docId) {
    const reqRef = doc(db, "pendingRequests", docId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) return;
    const req = reqSnap.data();
    const price = parseInt(req.price);

    // 1. Lasketaan hinnan nousu (1000€ = +0.1%, 10 000€ = +1%)
    const hintaSnap = await getDoc(doc(db, "digikolikko", "hintaData"));
    let currentPrice = hintaSnap.exists() ? hintaSnap.data().currentPrice : 500;
    
    // Kaava: jokainen 1000€ tuo 0.001 (0.1%) lisäyksen
    const increaseFactor = (price / 1000) * 0.001;
    const newPrice = Math.round(currentPrice * (1 + increaseFactor));

    // 2. Päivitetään uusi hinta tietokantaan
    await setDoc(doc(db, "digikolikko", "hintaData"), { currentPrice: newPrice }, { merge: true });

    // 3. Suoritetaan rahansiirto
    let buyerBal = await getBalance(req.role);
    let valtioBal = await getBalance("Valtio");
    await setBalance(req.role, buyerBal - price);
    await setBalance("Valtio", valtioBal + price);

    // 4. Päivitetään ilmoitus (sisältää tiedon uudesta hinnasta)
    const notifRef = doc(db, "notifications", req.role);
    const notifSnap = await getDoc(notifRef);
    let notifs = notifSnap.exists() ? notifSnap.data().list : [];
    notifs.push(`✅ OSTOS HYVÄKSYTTY: ${req.item} (-${price}€). Digikolikon uusi hinta: ${newPrice}€`);
    await setDoc(notifRef, { list: notifs }, { merge: true });

    await deleteDoc(reqRef);
    
    // 5. Päivitetään näkymä
    showAdminPanel();
    
    // Päivitetään myös pörssigraafi, jos se on ladattu
    if (typeof updateChart === 'function') {
        updateChart(newPrice);
    }
}

async function rejectShopReq(docId) {
    const reqRef = doc(db, "pendingRequests", docId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) return;
    const req = reqSnap.data();
    const notifRef = doc(db, "notifications", req.role);
    const notifSnap = await getDoc(notifRef);
    let notifs = notifSnap.exists() ? notifSnap.data().list : [];
    notifs.push("❌ OSTOS HYLÄTTY: " + req.item);
    await setDoc(notifRef, { list: notifs }, { merge: true });
    await deleteDoc(reqRef);
    showAdminPanel();
}

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
    if (currentRole !== "Valtio") return;
    document.getElementById("admin-content").style.display = "block";
    
    // Saldot
    const balC = document.getElementById("all-balances");
    balC.innerHTML = "<h3>Saldot:</h3>";
    for (let r in passwords) {
        const b = await getBalance(r);
        balC.innerHTML += `<div>${r}: ${b.toLocaleString()}€</div>`;
    }
    
    // Siirtopyynnöt
    const trans = await getDocs(collection(db, "moneyRequests"));
    const transC = document.getElementById("money-request-list");
    transC.innerHTML = "<h4>Siirtopyynnöt</h4>";
    trans.docs.forEach(d => {
        const r = d.data();
        transC.innerHTML += `<div>${r.from} → ${r.to}: ${r.amount}€ <button onclick="approveTransfer('${d.id}')">✅</button><button onclick="rejectTransfer('${d.id}')">❌</button></div>`;
    });
    
    // Ostopyynnöt ja pörssikurssin näyttö
    const shop = await getDocs(collection(db, "pendingRequests"));
    const shopC = document.getElementById("request-list");
    
    const hintaSnap = await getDoc(doc(db, "digikolikko", "hintaData"));
    const currentPrice = hintaSnap.exists() ? hintaSnap.data().currentPrice : 500;

    shopC.innerHTML = `
        <h4>Ostopyynnöt</h4>
        <div style="margin-bottom: 10px; color: #22c55e; font-weight: bold;">
            Nykyinen pörssikurssi: ${currentPrice.toLocaleString("fi-FI")} €
        </div>
    `;
    
    shop.docs.forEach(d => {
        const r = d.data();
        const price = parseFloat(r.price) || 0;
        shopC.innerHTML += `
            <div style="margin-bottom: 5px; border-bottom: 1px solid #334155; padding-bottom: 5px;">
                ${r.role}: ${r.item} (${price.toLocaleString("fi-FI")} €) 
                <button onclick="approveShopReq('${d.id}')">✅</button>
                <button onclick="rejectShopReq('${d.id}')">❌</button>
            </div>`;
    });
}

window.setDigikolikkoPrice = async function() {
    const newPrice = parseInt(document.getElementById("manualPrice").value);
    if (isNaN(newPrice)) return alert("Syötä kelvollinen numero!");
    
    await setDoc(doc(db, "digikolikko", "hintaData"), { currentPrice: newPrice }, { merge: true });
    
    // Päivitetään hinta näytölle heti
    const priceDisplay = document.getElementById("current-coin-price");
    if (priceDisplay) priceDisplay.innerText = newPrice;
    
    alert("Pörssikurssi päivitetty: " + newPrice + " €");
};
// ---------------- NOTIFICATIONS ----------------
async function showNotifications() {
    const container = document.getElementById("all-notifications");
    if (!container) return;
    
    const ref = doc(db, "notifications", currentRole);
    const snap = await getDoc(ref);
    const msgs = snap.exists() ? snap.data().list : [];
    
    container.innerHTML = "<h4>Ilmoitukset:</h4>";
    
    if (msgs.length === 0) {
        container.innerHTML += "<p>Ei uusia ilmoituksia.</p>";
        return;
    }

    msgs.forEach((m, index) => { 
        container.innerHTML += `
            <div style="background:#1e293b; padding:10px; margin:5px; border-radius:5px; display:flex; justify-content:space-between; align-items:center;">
                <span>${m}</span>
                <button onclick="deleteNotification(${index})" style="margin-left:10px; cursor:pointer;">OK</button>
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
function initChart() {
    const canvas = document.getElementById('digikolikkoChart');
    if (!canvas) return; 

    digikolikkoChart = new Chart(canvas.getContext('2d'), {
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
}

async function updateChart(newPrice) {
    if (digikolikkoChart) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        digikolikkoChart.data.labels.push(time);
        digikolikkoChart.data.datasets[0].data.push(newPrice);
        if (digikolikkoChart.data.labels.length > 20) {
            digikolikkoChart.data.labels.shift();
            digikolikkoChart.data.datasets[0].data.shift();
        }
        digikolikkoChart.update();
    }
}
async function deleteNotification(index) {
    const ref = doc(db, "notifications", currentRole);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    
    let msgs = snap.data().list;
    // Poistetaan yksi viesti sen indeksin perusteella
    msgs.splice(index, 1);
    
    // Tallennetaan päivitetty lista takaisin Firestoreen
    await setDoc(ref, { list: msgs }, { merge: true });
    
    // Päivitetään näkymä välittömästi
    showNotifications();
}
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
window.setDigikolikkoPrice = setDigikolikkoPrice;
window.updateChart = updateChart;
window.deleteNotification = deleteNotification;
