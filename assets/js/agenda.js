

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAnET6gJ175qHFbHcKm40tynj7s9x4sXqU",
    authDomain: "movimentaif.firebaseapp.com",
    databaseURL: "https://movimentaif-default-rtdb.firebaseio.com",
    projectId: "movimentaif",
    storageBucket: "movimentaif.firebasestorage.app",
    messagingSenderId: "705983497984",
    appId: "1:705983497984:web:f16672db437ce21aa2d5e5",
    measurementId: "G-5K2CYJ742W"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const API_BASE_URL = 'http://localhost:8080/api';
const DAY_SCHEDULE_API = `${API_BASE_URL}/charts/day`;
const WORKOUTS_API = `${API_BASE_URL}/workouts`;

const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

let currentDate = new Date();
let selectedDate = new Date();
let allAvailableWorkouts = []; // Cache para mapear IDs para Nomes

const calendarDaysEl = document.getElementById('calendar-days');
const monthYearEl = document.getElementById('month-year');
const scheduleListContentEl = document.getElementById('schedule-list-content');
const selectedDayNameEl = document.getElementById('selected-day-name');

async function getAuthTokenAndFetch(url, options = {}) {
    const user = auth.currentUser;
    if (!user) {
        // Redireciona se não houver usuário autenticado
        window.location.replace('index.html');
        return Promise.reject(new Error("No user authenticated."));
    }
    // Adiciona o token de autenticação para as requisições do backend
    const token = await user.getIdToken();
    const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
    return fetch(url, { ...options, headers });
}

onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('user-email').textContent = user.email;
        loadInitialData(); // Carrega treinos e agenda
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
    scheduleListContentEl.innerHTML = `<div class="text-center p-5"><div class="spinner-border text-primary" role="status"></div></div>`;
    try {
        // 1. Busca todos os treinos disponíveis (para mapear IDs para nomes)
        const workoutsResponse = await getAuthTokenAndFetch(WORKOUTS_API);
        if (!workoutsResponse.ok) throw new Error("Falha ao buscar a lista de treinos.");
        allAvailableWorkouts = await workoutsResponse.json();
        console.log("Treinos disponíveis:", allAvailableWorkouts);
        // 2. Renderiza o calendário e carrega a agenda do dia atual
        renderCalendar();
        selectDay(new Date());

    } catch (error) {
        scheduleListContentEl.innerHTML = `<div class="alert alert-danger" role="alert">Erro ao carregar dados: ${error.message}</div>`;
    }
}

function isSameDay(date1, date2) {
    return date1.getDate() === date2.getDate() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getFullYear() === date2.getFullYear();
}

function renderCalendar() {
    const today = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    // Salva o dia atual antes de mudar para o dia 1 do mês para calcular o grid
    currentDate.setDate(1);

    const firstDayIndex = currentDate.getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    monthYearEl.innerHTML = `${months[currentMonth]} ${currentYear}`;
    calendarDaysEl.innerHTML = '';

    for (let i = 0; i < firstDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'day-cell empty-day';
        calendarDaysEl.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const fullDate = new Date(currentYear, currentMonth, day);
        const dayCell = document.createElement('div');

        dayCell.className = 'day-cell bg-custom-white text-custom-slate-700 shadow-sm';
        dayCell.dataset.day = day;
        dayCell.innerHTML = `<span class="day-number fw-bold">${day}</span><div class="schedule-dot d-none"></div>`;

        if (isSameDay(fullDate, today)) {
            dayCell.classList.add('current-day');
        }
        if (isSameDay(fullDate, selectedDate)) {
            dayCell.classList.add('selected-day');
        }

        dayCell.addEventListener('click', () => {
            selectDay(fullDate);
        });

        calendarDaysEl.appendChild(dayCell);
    }
}

// --- Lógica de Seleção de Dia e Busca de Escala ---

function selectDay(date) {
    // Remove a seleção do dia anterior
    document.querySelectorAll('.day-cell').forEach(cell => {
        cell.classList.remove('selected-day');
    });

    selectedDate = date;
    const selectedCell = document.querySelector(`.day-cell[data-day="${date.getDate()}"]`);
    // Garante que a célula exista e pertença ao mês visível
    if (selectedCell && date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear()) {
        selectedCell.classList.add('selected-day');
    }

    const dayOfWeekIndex = date.getDay(); // 0 (Dom) a 6 (Sáb)
    const dayOfWeekName = dayNames[dayOfWeekIndex];

    // Atualiza o cabeçalho da lista de agendamentos
    selectedDayNameEl.textContent = `${date.getDate()} de ${months[date.getMonth()]}`;

    // Se for fim de semana, não faz a chamada API
    if (dayOfWeekIndex === 0 || dayOfWeekIndex === 6) {
        renderScheduleList([], true);
    } else {
        fetchSchedule(dayOfWeekName);
    }
}

async function fetchSchedule(dayOfWeek) {
    scheduleListContentEl.innerHTML = `
                <div class="text-center p-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Buscando escala...</span>
                    </div>
                </div>
            `;
    try {
        // Rota: /api/charts/day/{dayOfWeek} - Busca todos os alunos escalados para o dia
        const response = await getAuthTokenAndFetch(`${DAY_SCHEDULE_API}/${dayOfWeek}`);

        if (!response.ok) {
            throw new Error(`Falha ao buscar escala: ${response.statusText}`);
        }

        const scheduledUsers = await response.json();
        console.log("Usuários agendados para", dayOfWeek, ":", scheduledUsers);
        renderScheduleList(scheduledUsers, false);

    } catch (error) {
        scheduleListContentEl.innerHTML = `<div class="alert alert-danger" role="alert">Falha na API: ${error.message}</div>`;
    }
}
async function renderScheduleList(users, isWeekend) {
    scheduleListContentEl.innerHTML = '';

    if (isWeekend) {
        scheduleListContentEl.innerHTML = `<div class="alert alert-info text-center mt-3">Fim de semana. Não há escala padrão de treino.</div>`;
        return;
    }

    if (users.length === 0) {
        scheduleListContentEl.innerHTML = `<div class="alert alert-success text-center mt-3">Nenhum aluno escalado para este dia.</div>`;
        return;
    }

    // 1. Criar um array de promessas para buscar TODOS os UserWorkouts necessários
    const allUserWorkoutPromises = [];
    users.forEach(user => {
        (user.workoutIds || []).forEach(userWorkoutId => {
            allUserWorkoutPromises.push(getUserWorkout(userWorkoutId));
        });
    });

    // 2. Aguardar que TODOS os UserWorkouts sejam buscados da API
    const allUserWorkouts = (await Promise.all(allUserWorkoutPromises)).filter(Boolean); // Filtra nulos/erros

    // 3. Agora que temos os dados, renderizamos os cards
    users.forEach(user => {

        // Mapeia os IDs (que são UserWorkout IDs) para Nomes e Detalhes
        const workoutNamesHtml = (user.workoutIds || []).map(userWorkoutId => {

            // Encontra o UserWorkout detalhado que buscamos
            const userWorkout = allUserWorkouts.find(uw => uw.userWorkoutId === userWorkoutId);
            if (!userWorkout) return `<li class="list-group-item bg-light border-0 py-2 text-danger">Erro (UserWorkout não encontrado)</li>`;

            // Encontra o nome do treino
            const workout = allAvailableWorkouts.find(w => w.workoutId === userWorkout.workoutId);
            const name = workout ? workout.workoutName : `[Treino Desconhecido]`;

            // Exibe o formato SÉRIE x REPETIÇÃO x PESO
            const details = `${userWorkout.weight}Kg, ${userWorkout.repetitions} ${userWorkout.repetitions > 1 ? 'repetições' : 'repetição'}, ${userWorkout.series} ${userWorkout.series > 1 ? 'séries' : 'série'}`;

            return `
                        <a href="#" class="list-group-item bg-light border-0 py-2 workout-link-item" 
                           data-bs-toggle="modal" data-bs-target="#workoutDetailModal"
                           data-workout-id="${userWorkout.workoutId}">
                            <strong>${name}</strong> <br/>(${details})
                        </a>
                    `;
        }).join('<hr class="my-1">'); // Adiciona o <hr>

        const userCard = document.createElement('div');
        userCard.className = 'card mb-3 shadow-sm border-0 schedule-card';
        userCard.innerHTML = `
                    <div class="card-body">
                        <h6 class="mb-1 fw-bold text-custom-slate-800">${user.userName || 'Aluno sem nome'}</h6>
                        
                        <h6 class="fw-semibold mt-3">Treinos Agendados:</h6>
                        <div class="list-group list-group-flush border-top schedule-list-workouts">
                            ${workoutNamesHtml}
                        </div>
                        <hr class="my-1">
                        <div class="d-flex justify-content-between px-5">
                            <a href="user-details.html?uid=${user.userId}" class="btn btn-sm btn-outline-primary mt-3 rounded-pill">
                                Ver Perfil do Aluno
                            </a>
                            <a href="user-workout-chart.html?uid=${user.userId}" class="btn btn-sm btn-outline-primary mt-3 rounded-pill">
                                Ver Ficha de Treino
                            </a>
                        </div>
                    </div>
                `;
        scheduleListContentEl.appendChild(userCard);
    });

    // Adiciona listener global ao conteúdo para capturar cliques nos treinos
    scheduleListContentEl.addEventListener('click', handleWorkoutClick);
}

async function showWorkoutDetails(workoutId) {
    const modalBody = document.getElementById('modal-workout-content');
    modalBody.innerHTML = `<div class="text-center p-5"><div class="spinner-border text-primary" role="status"></div></div>`;

    try {
        const response = await getAuthTokenAndFetch(`${WORKOUTS_API}/${workoutId}`);
        const detailedWorkout = await getUserWorkout(workoutId);
        if (!response.ok) throw new Error("Treino não encontrado ou falha na API.");

        const workout = await response.json();

        const videoId = getYouTubeVideoId(workout.workoutVideoLink);
        const videoEmbed = videoId ? `
                    <div class="ratio ratio-16x9 rounded-3 shadow mb-3">
                        <iframe src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                    </div>
                ` : `<div class="alert alert-warning text-center">Este treino não possui um link de vídeo válido.</div>`;

        modalBody.innerHTML = `
                    <h5 class="fw-bold text-custom-slate-800">${workout.workoutName}</h5>
                    <p class="text-muted small">${workout.workoutDescription}</p>
                    <hr>
                    ${videoEmbed}
                `;
    } catch (error) {
        modalBody.innerHTML = `<div class="alert alert-danger" role="alert">${error.message}</div>`;
    }
}

function getYouTubeVideoId(url) {
    // Regex para links normais, curtos (youtu.be) e Shorts
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/;
    const match = url ? url.match(regex) : null;
    return match ? match[1] : null;
}

function handleWorkoutClick(e) {
    const link = e.target.closest('.workout-link-item');
    if (link) {
        e.preventDefault();
        const workoutId = link.dataset.workoutId;
        showWorkoutDetails(workoutId);
    }
}

// --- Navegação do Calendário ---

document.getElementById('prev-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
    // Tenta selecionar o mesmo dia do mês, se existir
    selectDay(new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDate.getDate()));
});

document.getElementById('next-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
    // Tenta selecionar o mesmo dia do mês, se existir
    selectDay(new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDate.getDate()));
});

async function getUserWorkout(userWorkoutId) {
    try {
        const USER_WORKOUTS_API = `${API_BASE_URL}/user-workouts`;
        const response = await getAuthTokenAndFetch(`${USER_WORKOUTS_API}/${userWorkoutId}`);
        if (!response.ok) throw new Error("Falha ao buscar o treino do usuário.");
        return await response.json();
    } catch (error) {
        console.error(error);
        return null;
    }

}