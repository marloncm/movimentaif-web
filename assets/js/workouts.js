import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAnET6gJ175qHFbHcKm40tynj7s9x4sXqU",
    authDomain: "movimentaif.firebaseapp.com",
    databaseURL: "https://movimentaif-default-rtdb.firebaseio.com",
    projectId: "movimentaif",
    storageBucket: "movimentaif.firebasestorage.app",
    messagingSenderId: "705983497984",
    appId: "1:705983497984:web:f16672db43ce21aa2d5e5",
    measurementId: "G-5K2CYJ742W"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const workoutsList = document.getElementById('workouts-list');
const workoutForm = document.getElementById('workoutForm');
const searchInput = document.getElementById('search-input'); // Seleção do campo de busca
const addEditWorkoutModal = new bootstrap.Modal(document.getElementById('addEditWorkoutModal'));
const modalTitle = document.getElementById('addEditWorkoutModalLabel');

const API_BASE_URL = 'http://localhost:8080/api/workouts';
let allWorkouts = []; // Variável para armazenar todos os treinos

async function getAuthTokenAndFetch(url, options = {}) {
    const user = auth.currentUser;
    if (!user) {
        console.error("No authenticated user to get token for.");
        window.location.replace('index.html');
        return Promise.reject(new Error("No user authenticated."));
    }
    const token = await user.getIdToken();
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };
    return fetch(url, { ...options, headers });
}

onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('user-email').textContent = user.email;
        fetchWorkouts();
    } else {
        window.location.replace('index.html');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.replace('index.html');
    });
});

async function fetchWorkouts() {
    workoutsList.innerHTML = `
                <div class="d-flex justify-content-center p-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Carregando...</span>
                    </div>
                </div>
            `;
    try {
        const response = await getAuthTokenAndFetch(API_BASE_URL);
        if (!response.ok) {
            throw new Error('Erro ao buscar treinos.');
        }
        const workouts = await response.json();
        allWorkouts = workouts; // Armazena todos os treinos
        renderWorkouts(allWorkouts);
    } catch (error) {
        workoutsList.innerHTML = `<div class="alert alert-danger text-center mt-4" role="alert">Erro ao carregar treinos: ${error.message}</div>`;
    }
}

function renderWorkouts(workouts) {
    workoutsList.innerHTML = '';
    if (workouts.length === 0) {
        workoutsList.innerHTML = `<div class="alert alert-info text-center mt-4" role="alert">Nenhum treino cadastrado.</div>`;
        return;
    }
    workouts.forEach(workout => {
        const workoutCard = document.createElement('div');
        workoutCard.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center my-2 rounded-3 shadow-sm';
        workoutCard.innerHTML = `
                    <div class="d-flex flex-column">
                        <h6 class="mb-1 fw-bold">${workout.workoutName}</h6>
                        <small class="text-muted text-truncate" style="max-width: 400px;">${workout.workoutDescription}</small>
                    </div>
                    <div class="d-flex gap-2">
                        <a href="workout-details.html?id=${workout.workoutId}" class="btn btn-outline-primary btn-sm rounded-pill"><i class="fa-solid fa-info-circle me-1"></i> Detalhes</a>
                        <button class="btn btn-outline-secondary btn-sm rounded-pill" data-bs-toggle="modal" data-bs-target="#addEditWorkoutModal" data-id="${workout.workoutId}"><i class="fa-solid fa-edit me-1"></i> Editar</button>
                        <button class="btn btn-outline-danger btn-sm rounded-pill" data-id="${workout.workoutId}"><i class="fa-solid fa-trash-alt me-1"></i> Excluir</button>
                    </div>
                `;
        workoutsList.appendChild(workoutCard);
    });
}

// NOVO LISTENER PARA O CAMPO DE BUSCA
searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredWorkouts = allWorkouts.filter(workout =>
        (workout.workoutName && workout.workoutName.toLowerCase().includes(searchTerm)) ||
        (workout.workoutDescription && workout.workoutDescription.toLowerCase().includes(searchTerm))
    );
    renderWorkouts(filteredWorkouts);
});

workoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const workoutId = document.getElementById('workoutId').value;
    const workoutName = document.getElementById('workoutName').value;
    const workoutDescription = document.getElementById('workoutDescription').value;
    const workoutVideoLink = document.getElementById('workoutVideoLink').value;

    const workoutData = { workoutName, workoutDescription, workoutVideoLink };

    try {
        const url = workoutId ? `${API_BASE_URL}/${workoutId}` : API_BASE_URL;
        const method = workoutId ? 'PUT' : 'POST';

        const response = await getAuthTokenAndFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(workoutData),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Erro ao salvar o treino.');
        }

        await fetchWorkouts();
        addEditWorkoutModal.hide();

    } catch (error) {
        alert(`Erro: ${error.message}`);
    }
});

workoutsList.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    if (e.target.classList.contains('btn-outline-danger')) {
        if (confirm('Tem certeza que deseja excluir este treino?')) {
            try {
                const response = await getAuthTokenAndFetch(`${API_BASE_URL}/${id}`, {
                    method: 'DELETE',
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || 'Erro ao excluir o treino.');
                }
                await fetchWorkouts();
            } catch (error) {
                alert(`Erro: ${error.message}`);
            }
        }
    } else if (e.target.classList.contains('btn-outline-secondary')) { // Botão Editar
        const response = await getAuthTokenAndFetch(`${API_BASE_URL}/${id}`);
        const workout = await response.json();
        document.getElementById('workoutId').value = workout.workoutId;
        document.getElementById('workoutName').value = workout.workoutName;
        document.getElementById('workoutDescription').value = workout.workoutDescription;
        document.getElementById('workoutVideoLink').value = workout.workoutVideoLink;
        modalTitle.textContent = 'Editar Treino';
    }
});

document.getElementById('addEditWorkoutModal').addEventListener('show.bs.modal', function (event) {
    const button = event.relatedTarget;
    const id = button ? button.getAttribute('data-id') : null;
    if (!id) {
        modalTitle.textContent = 'Adicionar Novo Treino';
        document.getElementById('workoutForm').reset();
        document.getElementById('workoutId').value = '';
    }
});