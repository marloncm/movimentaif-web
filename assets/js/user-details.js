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
const userDetailsContainer = document.getElementById('user-details-container');
const contentView = document.getElementById('content-view');
const toggleEditBtn = document.getElementById('toggle-edit-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const statusMessageEl = document.getElementById('status-message');

let currentUserData = null;
let currentUserId = null;
let currentTab = 'info';
let isEditing = false;

// --- Funções Auxiliares ---
function showMessage(message, isError = true) {
    statusMessageEl.textContent = message;
    statusMessageEl.classList.remove('d-none', 'alert-success', 'alert-danger', 'alert-warning');
    statusMessageEl.classList.add(isError ? 'alert-danger' : 'alert-success');
    setTimeout(() => statusMessageEl.classList.add('d-none'), 3000);
}

/**
 * Converte o valor de data (timestamp ou Date string) em formato local de data e hora.
 */
function formatDateTime(dateValue) {
    if (!dateValue) return 'N/A';

    let date;

    if (typeof dateValue === 'number' || (typeof dateValue === 'string' && /^\d+$/.test(dateValue))) {
        date = new Date(Number(dateValue));
    } else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
    }

    if (!date || isNaN(date.getTime())) return 'N/A';

    const dateOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };

    const formattedDate = date.toLocaleDateString('pt-BR', dateOptions);
    const formattedTime = date.toLocaleTimeString('pt-BR', timeOptions);

    return `${formattedDate} às ${formattedTime}`;
}

async function getAuthTokenAndFetch(url, options = {}) {
    const user = auth.currentUser;
    if (!user) {
        console.error("No authenticated user to get token for.");
        window.location.replace('index.html');
        return Promise.reject(new Error("No user authenticated."));
    }
    const token = await user.getIdToken();
    const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
    return fetch(url, { ...options, headers });
}

// --- Lógica de Autenticação e Carregamento Inicial ---
onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('user-email').textContent = user.email;
        fetchUserDetails();
    } else {
        window.location.replace('index.html');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.replace('index.html');
    });
});

// --- Funções de Edição de Status ---

function toggleEditMode() {
    if (currentTab !== 'info') {
        showMessage("A edição de status só pode ser feita na aba 'Informações Gerais'.", true);
        return;
    }

    isEditing = !isEditing;

    if (isEditing) {
        toggleEditBtn.innerHTML = '<i class="fa-solid fa-save me-1"></i> Salvar Alterações';
        toggleEditBtn.classList.remove('btn-warning');
        toggleEditBtn.classList.add('btn-success');
        // Exibe o botão Cancelar e desabilita o Ficha de Treinos
        cancelEditBtn.classList.remove('d-none');
        document.getElementById('view-workout-btn').disabled = true;
    } else {
        toggleEditBtn.innerHTML = '<i class="fa-solid fa-edit me-1"></i> Editar';
        toggleEditBtn.classList.remove('btn-success');
        toggleEditBtn.classList.add('btn-warning');
        // Esconde o botão Cancelar e reabilita o Ficha de Treinos
        cancelEditBtn.classList.add('d-none');
        document.getElementById('view-workout-btn').disabled = false;
    }

    renderUserTabs(currentTab); // Re-renderiza a aba Info no novo modo
}

async function saveUserStatus() {
    if (!currentUserData || !currentUserId) return;

    // 1. Coleta os novos valores dos switches
    const updatedData = {
        // Preservar todos os campos existentes para o PUT parcial funcionar
        ...currentUserData,

        // Campos booleanos de edição
        interviewed: document.getElementById('switch-interviewed')?.checked,
        didFirstWorkout: document.getElementById('switch-did-first-workout')?.checked,
        active: document.getElementById('switch-is-active')?.checked,
        signedTermOfCommitment: document.getElementById('switch-signed-commitment')?.checked
    };

    delete updatedData.toJSON;

    try {
        // Requisição PUT para o endpoint de atualização
        const response = await getAuthTokenAndFetch(`${API_BASE_URL}/${currentUserId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Falha ao salvar status. ${errorText}`);
        }

        // O backend deve retornar o objeto atualizado no PUT
        const updatedUser = await response.json();
        currentUserData = updatedUser;

        showMessage("Status do usuário salvo com sucesso!", false);

        // CRÍTICO: Força a saída do modo de edição em caso de sucesso
        isEditing = false;

    } catch (error) {
        showMessage(`Erro ao salvar: ${error.message}`, true);
        isEditing = true; // Mantém no modo de edição para o usuário corrigir
    } finally {
        // Se houve sucesso, isEditing=false (Sai da Edição).
        // Se houve erro, isEditing=true (Mantém Edição).

        // Garante que a tela renderize no estado final (visualização ou edição-erro)
        renderUserTabs(currentTab);

        // Chama o toggle para reverter os botões se o salvamento foi bem-sucedido.
        if (!isEditing) {
            toggleEditMode();
        }
    }
}

toggleEditBtn.addEventListener('click', () => {
    // Se estiver editando E o botão for o de salvar
    if (isEditing && toggleEditBtn.classList.contains('btn-success')) {
        saveUserStatus();
    } else {
        toggleEditMode();
    }
});

// NOVO LISTENER: Cancelar Edição (desfaz as alterações visuais e recarrega o estado do servidor)
cancelEditBtn.addEventListener('click', async () => {
    if (isEditing) {
        showMessage("Edição cancelada. Restaurando botões...", false);
        isEditing = false;

        // 1. Recarrega os dados originais do servidor (que desfaz as alterações não salvas)
        await fetchUserDetails();

        // 2. Garante que os botões voltem ao estado 'Editar'
        // NOTA: O fetchUserDetails chama renderUserTabs, que por sua vez chama toggleEditMode
        // O problema é que o fetchUserDetails não é assíncrono. Vamos forçar a mudança de estado aqui.
        toggleEditMode();
    }
});

// --- Funções de Renderização das Abas ---

function renderGeneralInfoContent(user, isEditingMode) {
    const checkIcon = '<i class="fa-solid fa-check-circle me-2 text-success"></i>';
    const crossIcon = '<i class="fa-solid fa-times-circle me-2 text-danger"></i>';

    // Funções de Status para o modo de visualização (Read-Only)
    const getStatusDisplay = (value, label) => `
                <li>
                    ${value ? checkIcon : crossIcon}
                    <span class="text-muted">${label}</span>
                </li>
            `;

    // Funções de Status para o modo de Edição (Switches)
    const getStatusSwitch = (id, label, description, checked) => `
                <div class="col-md-6">
                    <div class="switch-container">
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" role="switch" id="${id}" ${checked ? 'checked' : ''}>
                            <label class="form-check-label" for="${id}">${label}</label>
                            <p class="text-muted small mt-1 mb-0">${description}</p>
                        </div>
                    </div>
                </div>
            `;

    let statusBlockHTML = '';

    if (isEditingMode) {
        // Conteúdo no MODO EDIÇÃO (Switches)
        statusBlockHTML = `
                    <h5 class="fw-bold text-custom-slate-800 mb-3">Editar Status de Progresso</h5>
                    <div class="row">
                        ${getStatusSwitch('switch-interviewed', 'Realizou Entrevista', 'PAR-Q e Anamnese preenchidos.', user.interviewed || false)}
                        ${getStatusSwitch('switch-did-first-workout', 'Concluiu Primeiro Treino', 'Marco inicial do acompanhamento.', user.didFirstWorkout || false)}
                        ${getStatusSwitch('switch-is-active', 'Usuário Ativo', 'Pode acessar a academia e agendar treinos.', user.active || false)}
                        ${getStatusSwitch('switch-signed-commitment', 'Assinou Termo de Comp.', 'Requisito legal e de segurança.', user.signedTermOfCommitment || false)} 
                    </div>
                `;
    } else {
        // Conteúdo no MODO VISUALIZAÇÃO (Read-Only)
        statusBlockHTML = `
                    <h5 class="fw-bold text-custom-slate-800">Status de Progresso</h5>
                    <ul class="checkmark-list mt-3">
                        ${getStatusDisplay(user.interviewed, 'Realizou Entrevista')}
                        ${getStatusDisplay(user.didFirstWorkout, 'Concluiu Primeiro Treino')}
                        ${getStatusDisplay(user.scheduledFirstWorkout, 'Agendou Primeiro Treino')}
                        ${getStatusDisplay(user.active, 'Usuário Ativo')}
                        ${getStatusDisplay(user.signedTermOfCommitment, 'Termo de Compromisso Assinado')}
                    </ul>
                `;
    }

    // Formatação da data de nascimento (Age) e a nova formatação de data/hora
    const ageDate = user.age ? new Date(user.age).toLocaleDateString('pt-BR') : 'N/A';
    const firstWorkoutDate = formatDateTime(user.firstWorkoutDate);

    return `
                <div class="row">
                    <div class="col-md-5">
                        <div class="card shadow-sm p-4 rounded-3 bg-white mb-4">
                            ${statusBlockHTML}
                            
                            ${!isEditingMode ? `
                            <hr class="my-4">
                            <div>
                                <h5 class="fw-bold text-custom-slate-800">Dados do Primeiro Treino</h5>
                                <p class="text-muted mt-2">
                                    <i class="fa-solid fa-calendar-alt me-2"></i>
                                    Data do primeiro treino: <span class="fw-semibold">${firstWorkoutDate}</span>
                                </p>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="col-md-7">
                        <div class="card shadow-sm p-4 rounded-3 bg-white mb-4">
                            <h5 class="fw-bold text-custom-slate-800">Informações Pessoais</h5>
                            <div class="mt-3">
                                <p class="mb-2"><i class="fa-solid fa-user me-2"></i> <strong>Nome:</strong> <span>${user.userName || 'N/A'}</span></p>
                                <p class="mb-2"><i class="fa-solid fa-envelope me-2"></i> <strong>E-mail:</strong> <span>${user.email || 'N/A'}</span></p>
                                <p class="mb-2"><i class="fa-solid fa-phone me-2"></i> <strong>Telefone:</strong> <span>${user.phoneNumber || 'N/A'}</span></p>
                                <p class="mb-2"><i class="fa-solid fa-calendar-day me-2"></i> <strong>Data de Nasc:</strong> <span>${ageDate}</span></p>
                                <p class="mb-2"><i class="fa-solid fa-id-card me-2"></i> <strong>Afiliação:</strong> <span>${user.affiliationType || 'N/A'}</span></p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card shadow-sm mt-4 p-4 rounded-3 bg-white">
                    <h5 class="fw-bold text-custom-slate-800">Observações do Professor</h5>
                    <div class="form-floating mt-3">
                        <textarea class="form-control" placeholder="Deixe um comentário aqui" id="floatingTextarea2" style="height: 100px"></textarea>
                        <label for="floatingTextarea2" class="text-muted">Adicione suas observações...</label>
                    </div>
                </div>
            `;
}

// Função principal de renderização das abas (sem alteração)
function renderUserTabs(tab) {
    currentTab = tab;
    const tabs = {
        'info': document.getElementById('tab-info'),
        'parq': document.getElementById('tab-parq'),
        'anamnese': document.getElementById('tab-anamnese')
    };

    for (const key in tabs) {
        if (tabs[key]) tabs[key].classList.remove('active');
    }

    if (tabs[tab]) tabs[tab].classList.add('active');

    // CRÍTICO: Desabilita o botão de editar se não for a aba de Informações Gerais
    toggleEditBtn.disabled = (tab !== 'info');

    let contentHTML = '';

    if (tab === 'info') {
        contentHTML = renderGeneralInfoContent(currentUserData, isEditing);
    } else if (tab === 'parq') {
        contentHTML = `
                    <div class="alert alert-info text-center mt-4">
                        O conteúdo do Questionário PAR-Q será implementado aqui.
                    </div>
                `;
    } else if (tab === 'anamnese') {
        contentHTML = `
                    <div class="alert alert-info text-center mt-4">
                        O conteúdo da Ficha de Anamnese será implementado aqui.
                    </div>
                `;
    }

    contentView.innerHTML = contentHTML;
}

// --- Lógica de Carregamento de Dados ---

async function fetchUserDetails() {
    loadingSpinner.classList.remove('d-none');
    userDetailsContainer.classList.add('d-none');
    statusMessageEl.classList.add('d-none');

    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('uid');
    currentUserId = userId;

    if (!userId) {
        showMessage("ID do usuário não encontrado na URL.", true);
        loadingSpinner.classList.add('d-none');
        return;
    }

    try {
        const response = await getAuthTokenAndFetch(`${API_BASE_URL}/${userId}`);

        if (response.status === 404) {
            throw new Error('Usuário não encontrado.');
        }
        if (!response.ok) {
            throw new Error(`Erro ao buscar os dados do usuário. Status: ${response.status}`);
        }

        currentUserData = await response.json();

        // Redefine a URL de retorno para a tela de detalhes com o UID
        document.getElementById('back-to-users-btn').href = `users.html`;

        renderUserTabs(currentTab); // Carrega a aba ativa
        userDetailsContainer.classList.remove('d-none');

    } catch (error) {
        showMessage(`Erro ao carregar: ${error.message}`, true);
    } finally {
        loadingSpinner.classList.add('d-none');
    }
}

// --- Event Listeners ---

document.addEventListener('click', (e) => {
    if (e.target.id === 'tab-info') renderUserTabs('info');
    if (e.target.id === 'tab-parq') renderUserTabs('parq');
    if (e.target.id === 'tab-anamnese') renderUserTabs('anamnese');
});

document.getElementById('view-workout-btn').addEventListener('click', () => {
    if (currentUserId) {
        window.location.href = `user-workout-chart.html?uid=${currentUserId}`;
    } else {
        showMessage("Erro: ID do usuário não encontrado.", true);
    }
});
