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

// ---------------- OSTOTAPAHTUMIEN HALLINTA ----------------
async function approveShopReq(docId) {
    const reqRef = doc(db, "pendingRequests", docId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) return;
    const req = reqSnap.data();
    let buyerBal = await getBalance(req.role);
    let valtioBal = await getBalance("Valtio");
    await setBalance(req.role, buyerBal - parseInt(req.price));
    await setBalance("Valtio", valtioBal + parseInt(req.price));
    const notifRef = doc(db, "notifications", req.role);
    const notifSnap = await getDoc(notifRef);
    let notifs = notifSnap.exists() ? notifSnap.data().list : [];
    notifs.push("✅ OSTOS HYVÄKSYTTY: " + req.item + " (-" + req.price + "€)");
    await setDoc(notifRef, { list: notifs }, { merge: true });
    await deleteDoc(reqRef);
    showAdminPanel();
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
    const shop = await getDocs(collection(db, "pendingRequests"));
    const shopC = document.getElementById("request-list");
    shopC.innerHTML = "<h4>Ostopyynnöt</h4>";
    shop.docs.forEach(d => {
        const r = d.data();
        shopC.innerHTML += `<div>${r.role}: ${r.item} (${r.price}€) <button onclick="approveShopReq('${d.id}')">✅</button><button onclick="rejectShopReq('${d.id}')">❌</button></div>`;
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
const ctx = document.getElementById('digikolikkoChart').getContext('2d');
const digikolikkoChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: ['Alku'], 
        datasets: [{
            label: 'Digikolikko (€)',
            data: [500], // Lähtöhinta 500 €
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.2)',
            fill: true,
            tension: 0.3
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false
    }
});

// Päivitetty funktio graafille
window.updateDigikolikkoPrice = function(newPrice) {
    const dataSet = digikolikkoChart.data.datasets[0].data;
    
    // Pyöristetään luku kokonaisluvuksi graafia varten
    const roundedPrice = Math.round(newPrice);

    // Estetään turhat tuplapäivitykset
    if (dataSet[dataSet.length - 1] === roundedPrice) return;

    dataSet.push(roundedPrice);
    digikolikkoChart.data.labels.push(''); 
    digikolikkoChart.update();
};

// Vahtikoira: päivittää hinnan aina kun se muuttuu Firebasessa
onSnapshot(doc(db, "digikolikko", "hintaData"), (doc) => {
    if (doc.exists()) {
        const data = doc.data();
        if (data.currentPrice !== undefined) {
            updateDigikolikkoPrice(data.currentPrice);
        }
    }
});
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
window.updatePriceAfterTrade = updatePriceAfterTrade;
window.updateDigikolikkoPrice = updateDigikolikkoPrice;
