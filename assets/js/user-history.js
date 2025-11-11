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

const API_BASE_URL = 'http://localhost:8080/api';
const HISTORY_API = `${API_BASE_URL}/workout-history`;
const USERS_API = `${API_BASE_URL}/users`;
const WORKOUTS_API = `${API_BASE_URL}/workouts`;
const USER_WORKOUT_API = `${API_BASE_URL}/user-workouts`;

const loadingSpinner = document.getElementById('loading-spinner');
const historyContent = document.getElementById('history-content');
const errorAlert = document.getElementById('error-alert');
const userNameTitle = document.getElementById('user-name-title');

let currentUserId = null;

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
        loadInitialData();
    } else {
        window.location.replace('index.html');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.replace('index.html');
    });
});

async function loadInitialData() {
    loadingSpinner.classList.remove('d-none');
    historyContent.classList.add('d-none');
    errorAlert.classList.add('d-none');

    const urlParams = new URLSearchParams(window.location.search);
    currentUserId = urlParams.get('uid');

    if (!currentUserId) {
        showError("ID de usuário ausente.");
        return;
    }

    document.getElementById('back-btn').href = `user-details.html?uid=${currentUserId}`;

    try {
        // 1. Busca todos os dados necessários em paralelo
        const [
            userResponse,
            workoutsResponse,
            historyResponse,
            userWorkoutsResponse
        ] = await Promise.all([
            getAuthTokenAndFetch(`${USERS_API}/${currentUserId}`),
            getAuthTokenAndFetch(WORKOUTS_API), // Lista de nomes de treinos
            getAuthTokenAndFetch(`${HISTORY_API}/user/${currentUserId}`), // O Histórico (lista de fichas)
            getAuthTokenAndFetch(`${USER_WORKOUT_API}/user/${currentUserId}`) // Todos os UserWorkouts (detalhes)
        ]);

        // 2. Processa os dados
        if (!userResponse.ok) throw new Error("Falha ao buscar dados do usuário.");
        const currentUserData = await userResponse.json();
        userNameTitle.textContent = currentUserData.userName || currentUserData.email;

        if (!workoutsResponse.ok) throw new Error("Falha ao buscar a lista de treinos.");
        const allAvailableWorkouts = await workoutsResponse.json();

        const allUserWorkouts = userWorkoutsResponse.ok ? await userWorkoutsResponse.json() : [];

        // 3. Processa o Histórico
        if (historyResponse.status === 404) {
            renderEmptyHistory();
        } else if (!historyResponse.ok) {
            throw new Error("Falha ao carregar o histórico de fichas.");
        } else {
            const history = await historyResponse.json();
            renderHistory(history, allUserWorkouts, allAvailableWorkouts);
        }

    } catch (error) {
        showError(`Erro: ${error.message}`);
    } finally {
        loadingSpinner.classList.add('d-none');
    }
}

function showError(message) {
    errorAlert.textContent = message;
    errorAlert.classList.remove('d-none');
    loadingSpinner.classList.add('d-none');
}

function renderEmptyHistory() {
    historyContent.innerHTML = `
                <div class="alert alert-info text-center mt-3">
                    Este usuário ainda não possui fichas arquivadas.
                </div>
            `;
    historyContent.classList.remove('d-none');
}

function renderHistory(history, allUserWorkouts, allAvailableWorkouts) {
    const chartHistoryList = history.workoutCharts || [];

    if (chartHistoryList.length === 0) {
        renderEmptyHistory();
        return;
    }

    // Inverte a ordem para mostrar o mais novo primeiro
    chartHistoryList.reverse();

    let historyHTML = '';

    chartHistoryList.forEach((chart, index) => {
        const collapseId = `collapse-${chart.chartId}`;
        const titleId = `heading-${chart.chartId}`;
        const isCurrent = index === 0; // O mais novo é o primeiro da lista invertida

        // Mapeia os treinos da ficha para exibição em lista
        const dayWorkouts = {
            'Segunda-feira': chart.mondayWorkouts || [],
            'Terça-feira': chart.tuesdayWorkouts || [],
            'Quarta-feira': chart.wednesdayWorkouts || [],
            'Quinta-feira': chart.thursdayWorkouts || [],
            'Sexta-feira': chart.fridayWorkouts || []
        };

        let dayCardsHTML = '';

        for (const [dayName, userWorkoutIds] of Object.entries(dayWorkouts)) {
            if (userWorkoutIds && userWorkoutIds.length > 0) {

                const itemsHTML = userWorkoutIds.map(userWorkoutId => {
                    // 1. Encontra o UserWorkout detalhado (Peso, Reps, etc.)
                    const userWorkout = allUserWorkouts.find(uw => uw.userWorkoutId === userWorkoutId);
                    if (!userWorkout) return `<li class="list-group-item workout-list-item text-danger">Erro: Treino detalhado não encontrado</li>`;

                    // 2. Encontra o Nome do treino
                    const workout = allAvailableWorkouts.find(w => w.workoutId === userWorkout.workoutId);
                    const name = workout ? workout.workoutName : `[Treino Desconhecido]`;

                    // 3. Formata os detalhes
                    const weight = userWorkout.weight || 0; // Corrigido
                    const series = userWorkout.series || 1;
                    const reps = userWorkout.repetitions || 0;

                    return `<li class="list-group-item workout-list-item">
                                        <strong>${name}</strong> (${series}x${reps} x ${weight}kg)
                                        ${userWorkout.obs ? `<br><small class="text-muted">Obs: ${userWorkout.obs}</small>` : ''}
                                    </li>`;
                }).join('');

                dayCardsHTML += `
                            <div class="col-md-4 mb-3">
                                <div class="card bg-light">
                                    <div class="card-body py-2">
                                        <div class="day-title">${dayName}</div>
                                        <ul class="list-unstyled small mt-1">${itemsHTML}</ul>
                                    </div>
                                </div>
                            </div>
                        `;
            }
        }
        console.log(chart.startDate);
        // Card do histórico expansível (Accordion)
        historyHTML += `
                    <div class="card history-card mb-3">
                        <div class="card-header ${isCurrent ? 'bg-primary text-white' : 'bg-custom-white'}" id="${titleId}">
                            <h5 class="mb-0">
                                <button class="btn btn-link ${isCurrent ? 'text-white' : 'text-primary'}" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="${isCurrent ? 'true' : 'false'}">
                                    Ficha Arquivada #${chartHistoryList.length - index} (Arquivada em ${formatDateTime(chart.startDate || Date.now())})
                                </button>
                            </h5>
                        </div>

                        <div id="${collapseId}" class="collapse ${isCurrent ? 'show' : ''}" aria-labelledby="${titleId}">
                            <div class="card-body">
                                <div class="row">
                                    ${dayCardsHTML || '<div class="col-12"><p class="text-muted">Ficha arquivada, mas sem treinos cadastrados.</p></div>'}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
    });

    historyContent.innerHTML = historyHTML;
    historyContent.classList.remove('d-none');
}

function formatDateTime(dateValue) {
    if (!dateValue) return 'N/A';

    let date;

    if (typeof dateValue === 'number' || (typeof dateValue === 'string' && /^\d+$/.test(dateValue))) {
        date = new Date(Number(dateValue));
    } else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
    }

    if (!date || isNaN(date.getTime())) return 'N/A';

    // Formata a data (DD/MM/AAAA) e a hora (HH:MM)
    const dateOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };

    const formattedDate = date.toLocaleDateString('pt-BR', dateOptions);
    const formattedTime = date.toLocaleTimeString('pt-BR', timeOptions);

    return `${formattedDate} às ${formattedTime}`;
}