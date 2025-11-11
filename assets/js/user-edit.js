import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAnET6gJ175qHFbHcKm40tynj7s9x4sXqU",
    authDomain: "movimentaif.firebaseapp.com",
    projectId: "movimentaif",
    storageBucket: "movimentaif.firebasestorage.app",
    messagingSenderId: "705983497984",
    appId: "1:705983497984:web:f16672db437ce21aa2d5e5",
    measurementId: "G-5K2CYJ742W"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const API_BASE_URL = 'http://localhost:8080/api/users';
const loadingSpinner = document.getElementById('loading-spinner');
const editFormContainer = document.getElementById('edit-form-container');
const editUserStatusForm = document.getElementById('editUserStatusForm');
const statusMessageEl = document.getElementById('status-message');

let currentUserId = null;

function showMessage(message, isError = true) {
    statusMessageEl.textContent = message;
    statusMessageEl.classList.remove('d-none', 'alert-success', 'alert-danger');
    statusMessageEl.classList.add(isError ? 'alert-danger' : 'alert-success');
}

async function getAuthTokenAndFetch(url, options = {}) {
    const user = auth.currentUser;
    if (!user) {
        window.location.replace('index.html');
        return Promise.reject(new Error("No user authenticated."));
    }
    const token = await user.getIdToken();
    const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
    return fetch(url, { ...options, headers });
}

onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('user-email').textContent = user.email;
        loadEditForm();
    } else {
        window.location.replace('index.html');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.replace('index.html');
    });
});

// Navegação de volta para user-details
document.getElementById('back-btn').addEventListener('click', (e) => {
    e.preventDefault();
    if (currentUserId) {
        window.location.href = `user-details.html?uid=${currentUserId}`;
    } else {
        window.location.href = `users.html`;
    }
});

async function loadEditForm() {
    loadingSpinner.classList.remove('d-none');
    editFormContainer.classList.add('d-none');

    const urlParams = new URLSearchParams(window.location.search);
    currentUserId = urlParams.get('uid');

    if (!currentUserId) {
        alert("Erro: ID de usuário ausente.");
        window.location.href = 'users.html';
        return;
    }

    try {
        const response = await getAuthTokenAndFetch(`${API_BASE_URL}/${currentUserId}`);
        if (!response.ok) throw new Error("Falha ao carregar dados do usuário.");

        const user = await response.json();

        document.getElementById('user-name-title').textContent = user.userName || user.email;
        document.getElementById('user-id-field').value = currentUserId;

        // Preenche os switches com os valores atuais
        document.getElementById('edit-interviewed').checked = user.interviewed || false;
        document.getElementById('edit-did-first-workout').checked = user.didFirstWorkout || false;
        document.getElementById('edit-is-active').checked = user.isActive || false;
        // Simulação: Assinado
        document.getElementById('edit-signed-commitment').checked = user.interviewed || false;

        editFormContainer.classList.remove('d-none');

    } catch (error) {
        showMessage(`Erro: ${error.message}`, true);
    } finally {
        loadingSpinner.classList.add('d-none');
    }
}

editUserStatusForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const userId = document.getElementById('user-id-field').value;
    const interviewStatus = document.getElementById('edit-interviewed').checked;
    const firstWorkoutStatus = document.getElementById('edit-did-first-workout').checked;
    const activeStatus = document.getElementById('edit-is-active').checked;

    const updatedData = {
        interviewed: interviewStatus,
        didFirstWorkout: firstWorkoutStatus,
        isActive: activeStatus
        // Note: Outros campos como userName, email, etc., devem ser preservados pelo backend
    };

    try {
        const response = await getAuthTokenAndFetch(`${API_BASE_URL}/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Falha ao salvar status. ${errorText}`);
        }

        showMessage("Status do usuário salvo com sucesso!", false);
        // Redireciona de volta para a tela de detalhes após um pequeno delay
        setTimeout(() => {
            window.location.href = `user-details.html?uid=${userId}`;
        }, 1000);

    } catch (error) {
        showMessage(`Erro ao salvar: ${error.message}`, true);
    }
});