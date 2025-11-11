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

const loadingSpinner = document.getElementById('loading-spinner');
const chartContent = document.getElementById('chart-content');
const errorAlert = document.getElementById('error-alert');
const userNameTitle = document.getElementById('user-name-title');
// let addWorkoutModal = null;
const addWorkoutModal = new bootstrap.Modal(document.getElementById('addWorkoutModal'));

// E DEPOIS das definições de constantes, adicione:
function initializeModal() {
    const modalElement = document.getElementById('addWorkoutModal');
    if (modalElement) {
        addWorkoutModal = new bootstrap.Modal(modalElement);
    } else {
        console.error('Elemento do modal não encontrado para inicialização');
    }
}

let currentUserId = null;
let currentUserData = null;
let currentWorkoutChart = null;
let allAvailableWorkouts = [];
let currentDayKey = '';

const USER_WORKOUT_API = `${API_BASE_URL}/user-workouts`;
const CHART_API_BASE = `${API_BASE_URL}/charts`;
const HISTORY_API_BASE = `${API_BASE_URL}/workout-history`;


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
    chartContent.classList.add('d-none');
    errorAlert.classList.add('d-none');

    const urlParams = new URLSearchParams(window.location.search);
    currentUserId = urlParams.get('uid');
    if (!currentUserId) {
        showError("ID de usuário ausente.");
        return;
    }

    document.getElementById('back-btn').href = `user-details.html?uid=${currentUserId}`;

    try {
        // INICIALIZAR O MODAL PRIMEIRO
        // initializeModal();

        // 1. Busca os dados do usuário
        const userResponse = await getAuthTokenAndFetch(`${API_BASE_URL}/users/${currentUserId}`);
        if (!userResponse.ok) throw new Error("Falha ao buscar dados do usuário.");
        currentUserData = await userResponse.json();

        userNameTitle.textContent = currentUserData.userName || currentUserData.email;

        // 2. Busca todos os treinos disponíveis
        const workoutsResponse = await getAuthTokenAndFetch(`${API_BASE_URL}/workouts`);
        if (!workoutsResponse.ok) throw new Error("Falha ao buscar a lista de treinos.");
        allAvailableWorkouts = await workoutsResponse.json();

        // 3. Tenta buscar a ficha de treino
        const chartResponse = await getAuthTokenAndFetch(`${CHART_API_BASE}/user/${currentUserId}`);
        if (chartResponse.status === 404) {
            renderNoChartState();
        } else if (!chartResponse.ok) {
            throw new Error("Falha ao carregar a ficha de treinos.");
        } else {
            currentWorkoutChart = await chartResponse.json();
            renderChartView(currentWorkoutChart);
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

// --- Renderização de Estado (Sem Ficha) ---

function renderNoChartState() {
    chartContent.innerHTML = `
        <div class="alert alert-warning text-center mx-auto" style="max-width: 500px;">
            Este usuário ainda não possui uma ficha de treinos associada.
            <div class="d-grid mt-3">
                <button id="create-chart-btn" class="btn btn-success fw-bold">
                    <i class="fa-solid fa-plus me-1"></i> Criar Nova Ficha
                </button>
            </div>
        </div>
    `;
    chartContent.classList.remove('d-none');
    document.getElementById('create-chart-btn').addEventListener('click', () => {
        // Cria um objeto de ficha vazio, mas com o ID do usuário para o POST
        currentWorkoutChart = { userId: currentUserId, chartId: null };
        renderChartEditView(currentWorkoutChart);
    });
}

// --- Renderização de Visualização (Ficha Existente) ---

async function renderChartView(chart) {
    const days = {
        'mondayWorkouts': { name: 'Segunda-feira', workouts: chart.mondayWorkouts || [] },
        'tuesdayWorkouts': { name: 'Terça-feira', workouts: chart.tuesdayWorkouts || [] },
        'wednesdayWorkouts': { name: 'Quarta-feira', workouts: chart.wednesdayWorkouts || [] },
        'thursdayWorkouts': { name: 'Quinta-feira', workouts: chart.thursdayWorkouts || [] },
        'fridayWorkouts': { name: 'Sexta-feira', workouts: chart.fridayWorkouts || [] },
    };

    try {
        // Busca os UserWorkouts para obter os detalhes
        const userWorkoutsResponse = await getAuthTokenAndFetch(`${USER_WORKOUT_API}/user/${currentUserId}`);
        if (!userWorkoutsResponse.ok) throw new Error('Falha ao buscar detalhes dos treinos');
        const allUserWorkouts = await userWorkoutsResponse.json();

        let cardsHTML = '';
        let hasWorkouts = false;

        for (const [key, value] of Object.entries(days)) {
            const workoutList = value.workouts;

            if (workoutList.length > 0) {
                hasWorkouts = true;
                const itemsHTML = workoutList.map(userWorkoutId => {
                    const userWorkout = allUserWorkouts.find(uw => uw.userWorkoutId === userWorkoutId);
                    if (!userWorkout) return `<li class="list-group-item workout-list-item text-danger">Erro: Treino detalhado não encontrado</li>`;

                    const workout = allAvailableWorkouts.find(w => w.workoutId === userWorkout.workoutId);
                    const name = workout ? workout.workoutName : `[Treino Desconhecido]`;

                    return `<li class="list-group-item workout-list-item">
                            <strong>${name}</strong> <br/>(${userWorkout.weight || userWorkout.wieght || 0}kg x ${userWorkout.repetitions} reps
                             x ${userWorkout.series || 1} séries)
                            ${userWorkout.obs ? `<br><small class="text-muted">Obs: ${userWorkout.obs}</small>` : ''}
                        </li>`;
                }).join('');

                cardsHTML += `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="card shadow-sm bg-white day-card h-100">
                        <div class="card-body">
                            <h5 class="card-title fw-bold text-custom-slate-800">${value.name}</h5>
                            <ul class="list-group list-group-flush mt-3 border-top">
                                ${itemsHTML}
                            </ul>
                        </div>
                    </div>
                </div>
                `;
            }
        }

        if (!hasWorkouts) {
            cardsHTML = `<div class="alert alert-info text-center mt-3">A ficha existe, mas não há treinos cadastrados nesta semana.</div>`;
        }

        chartContent.innerHTML = `
        <div class="d-flex justify-content-end mb-3 gap-2">
            <button onclick="window.location.href='user-history.html?uid=${currentUserId}'" id="view-history-btn" class="btn btn-sm btn-info rounded">
                <i class="fa-solid fa-history me-1"></i> <b>Histórico de Treinos</b>
             </button>
            <button id="save-chart-to-history" class="btn btn-info fw-bold">
                <i class="fa-solid fa-edit me-1"></i> Gerar nova Ficha
            </button>    
            <button id="edit-chart-btn" class="btn btn-warning fw-bold">
                <i class="fa-solid fa-chart-bar me-1"></i> Editar Ficha
            </button>
        </div>
        <div class="row">${cardsHTML}</div>
        `;

        chartContent.classList.remove('d-none');
        document.getElementById('edit-chart-btn').addEventListener('click', () => {
            renderChartEditView(currentWorkoutChart);
        });

        document.getElementById('save-chart-to-history').addEventListener('click', async () => {
            await saveChartToHistory();//currentUserId
        });
    }
    catch (error) {
        showError(`Erro ao carregar ficha: ${error.message}`);
    }
}

// --- Renderização de Edição/Criação (Formulário) ---

async function renderChartEditView(chart) {
    const days = {
        'mondayWorkouts': { name: 'Segunda-feira', workouts: chart.mondayWorkouts || [] },
        'tuesdayWorkouts': { name: 'Terça-feira', workouts: chart.tuesdayWorkouts || [] },
        'wednesdayWorkouts': { name: 'Quarta-feira', workouts: chart.wednesdayWorkouts || [] },
        'thursdayWorkouts': { name: 'Quinta-feira', workouts: chart.thursdayWorkouts || [] },
        'fridayWorkouts': { name: 'Sexta-feira', workouts: chart.fridayWorkouts || [] },
    };

    // Busca os UserWorkouts para obter os detalhes
    let allUserWorkouts = [];
    try {
        const response = await getAuthTokenAndFetch(`${USER_WORKOUT_API}/user/${currentUserId}`);
        if (!response.ok) throw new Error('Falha ao buscar detalhes dos treinos');
        allUserWorkouts = await response.json();
    } catch (error) {
        console.error('Erro ao carregar user workouts:', error);
        // Tratamento adequado
    }
    let formHTML = '';
    for (const [key, value] of Object.entries(days)) {
        const itemsHTML = value.workouts.map(userWorkoutId => {
            const userWorkout = allUserWorkouts.find(uw => uw.userWorkoutId === userWorkoutId);
            if (!userWorkout) return ''; // Se o UserWorkout foi excluído

            const workout = allAvailableWorkouts.find(w => w.workoutId === userWorkout.workoutId);
            const name = workout ? workout.workoutName : `[Treino Desconhecido]`;

            return `<li class="list-group-item d-flex justify-content-between align-items-center text-custom-slate-800" data-id="${userWorkoutId}">
                        <span>${name} (${userWorkout.wieght}kg x ${userWorkout.repetitions} reps)</span>
                        <button type="button" class="btn-close" aria-label="Remove"></button>
                    </li>`;
        }).join('');

        formHTML += `
                        <div class="col-md-6 col-lg-4 mb-4">
                            <div class="card shadow-sm h-100">
                                <div class="card-header fw-bold">${value.name}</div>
                                <div class="card-body">
                                    <ul class="list-group" id="${key}-list">${itemsHTML}</ul>
                                    <button type="button" class="btn btn-outline-primary btn-sm mt-3 w-100 add-workout-btn" data-day-key="${key}">
                                        Adicionar Treino
                                    </button>
                                </div>
                            </div>
                        </div>
                        `;
    }

    chartContent.innerHTML = `
        <form id="chart-edit-form">
            <div class="row">${formHTML}</div>
            <div class="d-flex gap-2 mt-4">
                <button type="button" id="cancel-edit-btn-form" class="btn btn-secondary">Cancelar</button>
                <button type="submit" class="btn btn-success fw-bold">Salvar Ficha</button>
            </div>
        </form>
    `;
    chartContent.classList.remove('d-none');

    // Adiciona listeners
    document.getElementById('chart-edit-form').addEventListener('submit', saveChart);
    document.getElementById('cancel-edit-btn-form').addEventListener('click', loadInitialData);

    // Listener para remover treinos (close buttons)
    document.querySelectorAll('.list-group').forEach(list => {
        list.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-close')) {
                e.target.closest('li').remove();
            }
        });
    });

    document.querySelectorAll('.add-workout-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const dayKey = e.target.dataset.dayKey;
            console.log('Botão clicado, dayKey:', dayKey);
            showWorkoutSelectionModal(dayKey);
        });
    });

}

// CRÍTICO: Passo 1 - Exibe a lista de treinos disponíveis
function showWorkoutSelectionModal(dayKey) {
    console.log('Abrindo modal para:', dayKey);
    console.log('allAvailableWorkouts:', allAvailableWorkouts);

    if (!allAvailableWorkouts || allAvailableWorkouts.length === 0) {
        alert('A lista de treinos ainda não foi carregada. Tente novamente em alguns segundos.');
        return;
    }

    currentDayKey = dayKey;

    // Verificar se os elementos existem ANTES de manipulá-los
    const selectEl = document.getElementById('workout-select');
    const form = document.getElementById('user-workout-form');

    if (!selectEl) {
        console.error('Elemento workout-select não encontrado!');
        console.log('Elementos no DOM:', document.querySelectorAll('select'));
        alert('Erro: Elemento do formulário não encontrado. Recarregue a página.');
        return;
    }

    if (form) {
        form.classList.remove('was-validated');
    }

    // Popular o select
    selectEl.innerHTML = '<option value="" selected disabled>Selecione um treino...</option>';
    allAvailableWorkouts.forEach(workout => {
        selectEl.appendChild(new Option(workout.workoutName, workout.workoutId));
    });

    // Limpar outros campos com verificação
    const weightInput = document.getElementById('workout-weight');
    const repsInput = document.getElementById('workout-reps');
    const obsInput = document.getElementById('workout-obs');
    const seriesInput = document.getElementById('workout-series');

    if (weightInput) weightInput.value = '0';
    if (repsInput) repsInput.value = '1';
    if (seriesInput) seriesInput.value = '1';
    if (obsInput) obsInput.value = '';

    // Mostrar o modal
    if (addWorkoutModal) {
        addWorkoutModal.show();
    } else {
        console.error('Modal não inicializado');
    }
}

// Listener para o botão SALVAR DETALHES (Passo 2)
document.getElementById('save-user-workout-btn').addEventListener('click', async () => {
    const form = document.getElementById('user-workout-form');
    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
    }

    const workoutSelect = document.getElementById('workout-select');
    const workoutId = workoutSelect.value;
    const workoutName = workoutSelect.options[workoutSelect.selectedIndex].text; // Pega o nome

    const weight = document.getElementById('workout-weight').value;
    const repetitions = document.getElementById('workout-reps').value;
    const obs = document.getElementById('workout-obs').value;
    const series = document.getElementById('workout-series').value;
    const userWorkoutData = {
        userId: currentUserId,
        workoutId: workoutId,
        repetitions: parseInt(repetitions, 10),
        series: parseInt(series, 10),
        weight: parseFloat(weight),
        obs: obs
    };

    try {
        // 1. CHAMA A API: Cria o UserWorkout (Salva peso/rep.)
        const response = await getAuthTokenAndFetch(`${USER_WORKOUT_API}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userWorkoutData)
        });

        if (!response.ok) {
            throw new Error(`Falha ao registrar detalhes do treino. Status: ${response.status}`);
        }

        const newUserWorkout = await response.json();

        // 2. ADICIONA NA LISTA HTML DA FICHA
        const dayListEl = document.getElementById(`${currentDayKey}-list`);
        const newItem = document.createElement('li');
        newItem.className = 'list-group-item d-flex justify-content-between align-items-center text-custom-slate-800';
        newItem.dataset.id = newUserWorkout.userWorkoutId; // Salva o ID do UserWorkout
        newItem.innerHTML = `
                <span>${workoutName} (${weight}kg x ${repetitions} reps)</span>
                <button type="button" class="btn-close" aria-label="Remove"></button>
            `;

        dayListEl.appendChild(newItem);
        addWorkoutModal.hide();

    } catch (error) {
        alert(`Erro ao registrar treino: ${error.message}`);
    }
});


async function saveChart(e) {
    e.preventDefault();

    const isUpdate = currentWorkoutChart && currentWorkoutChart.chartId;

    // Mapeia os IDs de treino das listas HTML
    const chartData = {
        chartId: isUpdate ? currentWorkoutChart.chartId : undefined,
        userId: currentUserId,
        mondayWorkouts: Array.from(document.querySelectorAll('#mondayWorkouts-list li')).map(li => li.dataset.id),
        tuesdayWorkouts: Array.from(document.querySelectorAll('#tuesdayWorkouts-list li')).map(li => li.dataset.id),
        wednesdayWorkouts: Array.from(document.querySelectorAll('#wednesdayWorkouts-list li')).map(li => li.dataset.id),
        thursdayWorkouts: Array.from(document.querySelectorAll('#thursdayWorkouts-list li')).map(li => li.dataset.id),
        fridayWorkouts: Array.from(document.querySelectorAll('#fridayWorkouts-list li')).map(li => li.dataset.id),
    };

    try {
        const url = isUpdate ? `${CHART_API_BASE}/${chartData.chartId}` : `${CHART_API_BASE}`;
        const method = isUpdate ? 'PUT' : 'POST';

        const response = await getAuthTokenAndFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chartData)
        });

        if (!response.ok) {
            throw new Error(`Falha ao salvar a ficha de treinos. Status: ${response.status}`);
        }

        alert("Ficha de treinos salva com sucesso! A página será recarregada.");
        loadInitialData(); // Recarrega para ver o modo de visualização

    } catch (error) {
        alert(`Erro: ${error.message}`);
    }
}

// Navegação de volta para user-details
document.getElementById('back-btn').addEventListener('click', (e) => {
    e.preventDefault();
    if (currentUserId) {
        window.location.href = `user-details.html?uid=${currentUserId}`;
    } else {
        window.location.href = `users.html`;
    }
});

// Torna a função de abrir o modal global (acessível pelo onclick)
window.showWorkoutSelectionModal = (dayKey) => {
    showWorkoutSelectionModal(dayKey);
};


async function saveChartToHistory() {
    if (!currentUserId || !currentWorkoutChart || !currentWorkoutChart.chartId) {
        alert("Não é possível arquivar. A ficha atual ainda não foi salva ou o usuário não foi encontrado.");
        return;
    }

    try {
        // 1. Tenta buscar o histórico existente
        let historyResponse = await getAuthTokenAndFetch(`${HISTORY_API_BASE}/user/${currentUserId}`);
        let chartHistoryData;
        const currentChartToArchive = currentWorkoutChart; // Objeto da ficha a ser arquivada

        if (historyResponse.status === 404) {
            // 2. Se não existir (404), cria um novo objeto
            chartHistoryData = {
                userId: currentUserId,
                workoutCharts: [currentChartToArchive] // Salva o objeto inteiro
            };

            // 3. Salva (POST)
            const postResponse = await getAuthTokenAndFetch(HISTORY_API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chartHistoryData)
            });
            if (!postResponse.ok) throw new Error(`Falha ao criar o histórico de fichas. Status: ${postResponse.status}`);

            //bloco de teste
            // {
            //     const testeResponse = await getAuthTokenAndFetch(`${HISTORY_API_BASE}/user/${currentUserId}`);
            //     if (testeResponse.ok) {
            //         const testeData = await testeResponse.json();
            //         console.log("Histórico criado:", testeData);
            //     } else {
            //         console.error("Falha ao verificar o histórico criado. Status:", testeResponse.status);
            //     }
            //     return;
            // }
            console.log("salvou");
        } else if (historyResponse.ok) {
            // 4. Se existir (200), atualiza
            chartHistoryData = await historyResponse.json();

            // CRÍTICO: Adiciona o objeto da ficha atual à lista
            chartHistoryData.workoutCharts.push(currentChartToArchive);

            // 5. Atualiza (PUT)
            const putResponse = await getAuthTokenAndFetch(`${HISTORY_API_BASE}/${chartHistoryData.historyId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chartHistoryData)
            });
            if (!putResponse.ok) throw new Error(`Falha ao atualizar o histórico de fichas. Status: ${putResponse.status}`);

            console.log("atualizou");
        } else {
            throw new Error(`Erro desconhecido ao buscar histórico. Status: ${historyResponse.status}`);
        }

        // 6. Deleta a ficha de treino atual (WorkoutChart)
        const deleteResponse = await getAuthTokenAndFetch(`${CHART_API_BASE}/${currentWorkoutChart.chartId}`, {
            method: 'DELETE'
        });
        if (!deleteResponse.ok) {
            throw new Error(`Falha ao deletar a ficha atual. Status: ${deleteResponse.status}`);
        }

        alert("Ficha arquivada com sucesso! Uma nova ficha em branco será criada.");

        // 7. Recarrega a página (que agora mostrará o estado "Sem Ficha")
        window.location.reload();

    } catch (error) {
        alert(`Erro ao gerar nova ficha: ${error.message}`);
    }
}

/*
TODO: ALTERAR A CLASSE DE HISTÓRICO PARA RECEBER UMA LISTA DE OBJETOS DE FICHA
*/