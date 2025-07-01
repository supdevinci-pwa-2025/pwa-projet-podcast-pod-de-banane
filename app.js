let members = JSON.parse(localStorage.getItem("podcastMembers")) || [];

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
  .then((reg) => {
    // registration worked
    console.log('Enregistrement réussi');
  }).catch((error) => {
    // registration failed
    console.log('Erreur : ' + error);
  });
}

function addMember() {
    const nameInput = document.getElementById("memberName");
    const roleInput = document.getElementById("memberRole");
    const name = nameInput.value.trim();
    const role = roleInput.value;

    if (name === "") {
        alert("Veuillez entrer un nom.");
        return;
    }

    const newMember = { name, role };
    members.push(newMember);
    localStorage.setItem("podcastMembers", JSON.stringify(members));
    nameInput.value = "";
    displayMembers();
}

function displayMembers() {
    const list = document.getElementById("teamList");
    list.innerHTML = "";

    let count = { total: 0, Voix: 0, Script: 0, Montage: 0 };

    members.forEach(({ name, role }, index) => {
        const div = document.createElement("div");
        div.className = "member";
        div.innerHTML = `
      <span>${name} – ${role}</span>
      <button onclick="removeMember(${index})">❌</button>
    `;
        list.appendChild(div);
        count.total++;
        count[role]++;
    });

    document.getElementById("total").textContent = count.total;
    document.getElementById("voice").textContent = count["Voix"];
    document.getElementById("script").textContent = count["Script"];
    document.getElementById("montage").textContent = count["Montage"];
}

function removeMember(index) {
    members.splice(index, 1);
    localStorage.setItem("podcastMembers", JSON.stringify(members));
    displayMembers();
}

displayMembers();