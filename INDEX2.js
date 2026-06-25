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

window.onload = function() {
    let savedRole = sessionStorage.getItem("loggedInRole");
    let savedPage = sessionStorage.getItem("activePage") || "home";
    if (savedRole) {
        currentRole = savedRole;
        document.getElementById("loginPage").style.display = "none";
        document.getElementById("dashboard").style.display = "block";
        let bal = localStorage.getItem("balance_" + currentRole) || defaultBalances[currentRole];
        document.getElementById("userBalance").textContent = parseInt(bal).toLocaleString('fi-FI');
        show(savedPage);
        showNotifications();
        renderSuggestions();
    }
};

function login() {
    const role = document.getElementById("role").value;
    const pass = document.getElementById("password").value;
    if (passwords[role] !== pass) return alert("Väärä salasana!");
    sessionStorage.setItem("loggedInRole", role);
    location.reload(); 
}

function show(pageId) {
    sessionStorage.setItem("activePage", pageId); 
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    if (pageId === 'shopping') renderShop();
    if (pageId === 'admin-panel') showAdminPanel();
    if (pageId === 'transfer-page') renderMyTransferRequests();
    if (document.getElementById("suggestion-responses")) renderSuggestions();
}

// --- MAKSU JA SAKKO (PÄIVITETTY) ---
function processTransaction(multiplier) {
    const reason = document.getElementById("transactionReason").value;
    const target = document.getElementById("targetRole").value;
    const amount = parseInt(document.getElementById("globalAmount").value);

    if (!reason || isNaN(amount) || amount <= 0) return alert("Täytä perustelu ja summa!");

    let targetBal = parseInt(localStorage.getItem("balance_" + target)) || defaultBalances[target];

    if (multiplier === 1) { 
        // MAKSU: Vain lisäys vastaanottajalle
        localStorage.setItem("balance_" + target, targetBal + amount);
        alert("Maksu suoritettu: " + amount + "€ lisätty tilille " + target);
    } else { 
        // SAKKO: Vain vähennys uhrilta
        if (targetBal < amount) return alert("Kohteella ei ole tarpeeksi varoja sakkoon!");
        localStorage.setItem("balance_" + target, targetBal - amount);
        alert("Sakko määrätty: " + amount + "€ poistettu kohteelta " + target);
    }
    location.reload();
}

// --- KAUPPA ---
function addProduct() {
    if (currentRole !== "Valtio") return alert("Vain Valtio voi lisätä tuotteita!");
    let name = document.getElementById("itemName").value;
    let desc = document.getElementById("itemDesc").value;
    let price = parseInt(document.getElementById("itemPrice").value);
    let cat = document.getElementById("itemCategory").value;
    if (!name || !desc || isNaN(price) || !cat) return alert("Täytä kaikki kentät!");
    
    let shopItems = JSON.parse(localStorage.getItem("shopItems") || "[]");
    shopItems.push({ id: Date.now(), name, desc, price, category: cat, isSoldOut: false });
    localStorage.setItem("shopItems", JSON.stringify(shopItems));
    
    let cats = JSON.parse(localStorage.getItem("shopCategories") || '["Kirjat", "Luvat", "Koulutukset"]');
    if (!cats.includes(cat)) { cats.push(cat); localStorage.setItem("shopCategories", JSON.stringify(cats)); }
    renderShop();
}

function renderShop() {
    const container = document.getElementById("shop-items-container");
    if (!container) return;
    let shopItems = JSON.parse(localStorage.getItem("shopItems") || "[]");
    let cats = JSON.parse(localStorage.getItem("shopCategories") || '["Kirjat", "Luvat", "Koulutukset"]');
    container.innerHTML = "";
    cats.forEach(cat => {
        let items = shopItems.filter(i => i.category === cat);
        if (items.length > 0) {
            container.innerHTML += `<h3 style="margin:20px 0; color:#22c55e;">${cat}</h3>`;
            items.forEach(item => {
                let style = item.isSoldOut ? "background:#450a0a;" : "background:#1e293b;";
                container.innerHTML += `<div style="${style} padding:15px; border-radius:8px; margin-bottom:10px;">
                    <strong>${item.name}</strong> - ${item.price}€<p>${item.desc}</p>
                    <button onclick="${item.isSoldOut ? '' : 'buy('+item.price+', \''+item.name+'\')'}">${item.isSoldOut ? 'LOPPUUNMYYTY' : 'Osta'}</button>
                    ${currentRole === "Valtio" ? `
                        <button onclick="toggleSoldOut('${item.id}')">Tila</button>
                        <button onclick="editItem('${item.id}')">Muokkaa</button>
                        <button onclick="deleteItem('${item.id}')" style="background:red;">Poista</button>
                    ` : ''}
                </div>`;
            });
        }
    });
}

function toggleSoldOut(id) {
    let items = JSON.parse(localStorage.getItem("shopItems"));
    items.find(i => i.id == id).isSoldOut = !items.find(i => i.id == id).isSoldOut;
    localStorage.setItem("shopItems", JSON.stringify(items));
    renderShop();
}

function editItem(id) {
    let items = JSON.parse(localStorage.getItem("shopItems"));
    let item = items.find(i => i.id == id);
    item.name = prompt("Uusi nimi:", item.name) || item.name;
    item.price = parseInt(prompt("Uusi hinta:", item.price) || item.price);
    localStorage.setItem("shopItems", JSON.stringify(items));
    renderShop();
}

function deleteItem(id) {
    if(!confirm("Poistetaanko tuote?")) return;
    let items = JSON.parse(localStorage.getItem("shopItems"));
    localStorage.setItem("shopItems", JSON.stringify(items.filter(i => i.id != id)));
    renderShop();
}

function buy(price, name) {
    let bal = parseInt(localStorage.getItem("balance_" + currentRole)) || defaultBalances[currentRole];
    if (bal >= price) {
        let reqs = JSON.parse(localStorage.getItem("pendingRequests") || "[]");
        reqs.push({ role: currentRole, item: name, price: price });
        localStorage.setItem("pendingRequests", JSON.stringify(reqs));
        alert("Ostopyyntö lähetetty!");
    } else { alert("Ei riittävästi varoja!"); }
}

function submitTransferRequest() {
    let to = document.getElementById("transferTo").value;
    let amount = document.getElementById("transferAmount").value;
    let reason = document.getElementById("transferReason").value;
    if (!to || !amount || !reason) return alert("Täytä kaikki kentät!");
    let reqs = JSON.parse(localStorage.getItem("moneyRequests") || "[]");
    reqs.push({ from: currentRole, to: to, amount: amount, reason: reason });
    localStorage.setItem("moneyRequests", JSON.stringify(reqs));
    document.getElementById("transferTo").value = "";
    document.getElementById("transferAmount").value = "";
    document.getElementById("transferReason").value = "";
    alert("Siirtopyyntö lähetetty Valtiolle!");
}

function renderMyTransferRequests() { }

function showAdminPanel() {
    if (currentRole !== "Valtio") return;
    document.getElementById("admin-content").style.display = "block";
    const balC = document.getElementById("all-balances");
    balC.innerHTML = "<h3>📊 Saldot:</h3>";
    for (let r in passwords) {
        let b = localStorage.getItem("balance_" + r) || defaultBalances[r];
        balC.innerHTML += `<div>${r}: ${parseInt(b).toLocaleString()}€</div>`;
    }
    const transC = document.getElementById("money-request-list");
    let reqs = JSON.parse(localStorage.getItem("moneyRequests") || "[]");
    transC.innerHTML = "<h4>⚖️ Siirtopyynnöt:</h4>";
    reqs.forEach((r, i) => transC.innerHTML += `<div>${r.from}->${r.to}: ${r.amount}€ 
        <button onclick="approveTransfer(${i})">✅</button><button onclick="rejectTransfer(${i})">❌</button></div>`);
    const shopC = document.getElementById("request-list");
    let shopReqs = JSON.parse(localStorage.getItem("pendingRequests") || "[]");
    shopC.innerHTML = "<h4>⏳ Odottavat ostopyynnöt:</h4>";
    shopReqs.forEach((r, i) => shopC.innerHTML += `<div>${r.role}: ${r.item} (${r.price}€) 
        <button onclick="approveShopReq(${i})">✅</button><button onclick="rejectShopReq(${i})">❌</button></div>`);
}

function approveTransfer(i) {
    let reqs = JSON.parse(localStorage.getItem("moneyRequests"));
    let r = reqs[i];
    let notifs = JSON.parse(localStorage.getItem("user_notifs_" + r.from) || "[]");
    notifs.push("✅ SIIRTO HYVÄKSYTTY: " + r.amount + "€ (" + r.to + ")");
    localStorage.setItem("user_notifs_" + r.from, JSON.stringify(notifs));
    reqs.splice(i, 1);
    localStorage.setItem("moneyRequests", JSON.stringify(reqs));
    showAdminPanel();
}

function rejectTransfer(i) {
    let reqs = JSON.parse(localStorage.getItem("moneyRequests"));
    let r = reqs[i];
    let notifs = JSON.parse(localStorage.getItem("user_notifs_" + r.from) || "[]");
    notifs.push("❌ SIIRTO HYLÄTTY: " + r.amount + "€ (" + r.reason + ")");
    localStorage.setItem("user_notifs_" + r.from, JSON.stringify(notifs));
    reqs.splice(i, 1);
    localStorage.setItem("moneyRequests", JSON.stringify(reqs));
    showAdminPanel();
}

function approveShopReq(i) {
    let reqs = JSON.parse(localStorage.getItem("pendingRequests"));
    let req = reqs[i];
    let buyerBal = parseInt(localStorage.getItem("balance_" + req.role)) || defaultBalances[req.role];
    localStorage.setItem("balance_" + req.role, buyerBal - req.price);
    let valtioBal = parseInt(localStorage.getItem("balance_Valtio")) || defaultBalances["Valtio"];
    localStorage.setItem("balance_Valtio", valtioBal + req.price);
    let notifs = JSON.parse(localStorage.getItem("user_notifs_" + req.role) || "[]");
    notifs.push("✅ OSTOS HYVÄKSYTTY: " + req.item + " (-" + req.price + "€)");
    localStorage.setItem("user_notifs_" + req.role, JSON.stringify(notifs));
    reqs.splice(i, 1);
    localStorage.setItem("pendingRequests", JSON.stringify(reqs));
    showAdminPanel();
}

function rejectShopReq(i) {
    let reqs = JSON.parse(localStorage.getItem("pendingRequests"));
    let req = reqs[i];
    let notifs = JSON.parse(localStorage.getItem("user_notifs_" + req.role) || "[]");
    notifs.push("❌ OSTOS HYLÄTTY: " + req.item);
    localStorage.setItem("user_notifs_" + req.role, JSON.stringify(notifs));
    reqs.splice(i, 1);
    localStorage.setItem("pendingRequests", JSON.stringify(reqs));
    showAdminPanel();
}

function showNotifications() {
    const container = document.getElementById("all-notifications");
    if (!container) return;
    let msgs = JSON.parse(localStorage.getItem("user_notifs_" + currentRole) || "[]");
    container.innerHTML = "";
    msgs.forEach((m, i) => container.innerHTML += `<div>${m} <button onclick="dismissNotif(${i})">OK</button></div>`);
}

function dismissNotif(i) {
    let msgs = JSON.parse(localStorage.getItem("user_notifs_" + currentRole) || "[]");
    msgs.splice(i, 1);
    localStorage.setItem("user_notifs_" + currentRole, JSON.stringify(msgs));
    showNotifications();
}

function submitSuggestion() {
    let text = document.getElementById("devSuggestion").value;
    if (!text) return alert("Kirjoita ensin idea!");
    let suggestions = JSON.parse(localStorage.getItem("devSuggestions") || "[]");
    suggestions.push({ from: currentRole, text: text, reply: "" });
    localStorage.setItem("devSuggestions", JSON.stringify(suggestions));
    document.getElementById("devSuggestion").value = "";
    alert("Ehdotus lähetetty Valtiolle!");
    renderSuggestions();
}

function renderSuggestions() {
    const container = document.getElementById("suggestion-responses");
    if (!container) return;
    let suggestions = JSON.parse(localStorage.getItem("devSuggestions") || "[]");
    container.innerHTML = "<h4>Ideat ja vastaukset:</h4>";
    suggestions.forEach((s, i) => {
        let isAdmin = (currentRole === "Valtio");
        container.innerHTML += `<div style="background: #2d3748; padding: 10px; margin-bottom: 10px; border-radius: 5px;">
            <p><strong>${s.from}</strong>: ${s.text}</p>
            ${s.reply ? `<p style="color: #3b82f6;"><em>Valtion vastaus: ${s.reply}</em></p>` : ""}
            ${isAdmin ? `
                <input type="text" id="reply-${i}" placeholder="Kirjoita vastaus..." style="width: 70%; color: black;">
                <button onclick="sendReply(${i})">Lähetä vastaus</button>
                <button onclick="deleteSuggestion(${i})" style="background: red;">Poista</button>
            ` : ""}
        </div>`;
    });
}

function sendReply(i) {
    let replyText = document.getElementById("reply-" + i).value;
    if (!replyText) return alert("Kirjoita vastaus!");
    let suggestions = JSON.parse(localStorage.getItem("devSuggestions"));
    suggestions[i].reply = replyText;
    localStorage.setItem("devSuggestions", JSON.stringify(suggestions));
    renderSuggestions();
}

function deleteSuggestion(i) {
    let suggestions = JSON.parse(localStorage.getItem("devSuggestions"));
    suggestions.splice(i, 1);
    localStorage.setItem("devSuggestions", JSON.stringify(suggestions));
    renderSuggestions();
}
  