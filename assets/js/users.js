import { getAuthTokenAndFetch, auth, API_BASE_URL } from "./firebaseConfig.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// const app = initializeApp(firebaseConfig);
// const auth = getAuth(app);

const usersListEl = document.getElementById('users-list');
const usersListBodyEl = document.getElementById('users-list-body');
const searchInput = document.getElementById('search-input');

// const API_BASE_URL = 'http://localhost:8080/api/users';
const usersUrl = `${API_BASE_URL}/users`;
let allUsers = []; // Armazena todos os usuários carregados


onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('user-email').textContent = user.email;
        fetchUsers();
    } else {
        window.location.replace('index.html');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.replace('index.html');
    });
});

async function fetchUsers() {
    usersListBodyEl.innerHTML = `
                <div class="d-flex justify-content-center p-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Carregando usuários...</span>
                    </div>
                </div>
            `;
    try {
        // Rota para buscar apenas usuários do app móvel
        const response = await getAuthTokenAndFetch(`${usersUrl}/appusers`);
        if (!response.ok) {
            throw new Error('Erro ao buscar lista de usuários.');
        }
        const users = await response.json();
        allUsers = users; // Armazena para a busca
        renderUsers(allUsers);
    } catch (error) {
        usersListBodyEl.innerHTML = `<div class="alert alert-danger text-center mt-4" role="alert">Erro ao carregar usuários: ${error.message}</div>`;
    }
}

function renderUsers(users) {
    usersListBodyEl.innerHTML = '';
    if (users.length === 0) {
        usersListBodyEl.innerHTML = `<div class="alert alert-info text-center mt-4" role="alert">Nenhum usuário encontrado.</div>`;
        return;
    }

    users.forEach(user => {
        // LÓGICA DO STATUS (Corrigida para 'active' do backend)
        const isActive = user.active === true;
        const statusText = isActive ? 'Ativo' : 'Inativo';
        const statusClass = isActive ? 'bg-success' : 'bg-danger';

        const userCard = document.createElement('div');
        userCard.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center border-top-0 border-end-0 border-start-0';

        userCard.innerHTML = `
                    <div class="d-flex flex-column" style="width: 40%">
                        <h6 class="mb-0 fw-bold">${user.userName || 'Nome não definido'}</h6>
                        <small class="text-muted">${user.email || 'Email não definido'}</small>
                    </div>
                    
                    <!-- Coluna do Status Centralizado -->
                    <div class="text-center" style="width: 20%">
                        <span class="badge ${statusClass} rounded-pill">${statusText}</span>
                    </div>

                    <!-- Coluna de Ações Alinhada à Direita (Sempre visível) -->
                    <div class="text-end d-flex gap-2 justify-content-end" style="width: 20%">
                        <a href="user-details.html?uid=${user.userId}" class="btn btn-sm btn-outline-primary rounded-pill">
                            <i class="fa-solid fa-info-circle me-1"></i> Detalhes
                        </a>
                        <!-- Exemplo de Botão Excluir (Deixado como comentário para exclusão real) -->
                        <!-- <button class="btn btn-sm btn-outline-danger rounded-pill"><i class="fa-solid fa-trash-alt"></i></button> -->
                    </div>
                `;
        usersListBodyEl.appendChild(userCard);
    });
}

// Listener para a busca em tempo real
searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredUsers = allUsers.filter(user =>
        (user.userName && user.userName.toLowerCase().includes(searchTerm)) ||
        (user.email && user.email.toLowerCase().includes(searchTerm))
    );
    renderUsers(filteredUsers);
});