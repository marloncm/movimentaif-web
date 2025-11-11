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

const workoutContent = document.getElementById('workout-content');
const API_BASE_URL = 'http://localhost:8080/api/workouts';

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

onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('user-email').textContent = user.email;
        const urlParams = new URLSearchParams(window.location.search);
        const workoutId = urlParams.get('id');
        if (workoutId) {
            fetchWorkoutDetails(workoutId);
        } else {
            workoutContent.innerHTML = `<div class="alert alert-warning">Treino não encontrado.</div>`;
        }
    } else {
        window.location.replace('index.html');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.replace('index.html');
    });
});

document.getElementById('back-btn').addEventListener('click', () => {
    window.location.href = 'workouts.html';
});

async function fetchWorkoutDetails(id) {
    try {
        // O spinner é exibido por padrão no HTML.
        const response = await getAuthTokenAndFetch(`${API_BASE_URL}/${id}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Erro ao buscar detalhes do treino.');
        }
        const workout = await response.json();
        renderWorkoutDetails(workout);
    } catch (error) {
        workoutContent.innerHTML = `<div class="alert alert-danger text-center mt-4" role="alert">Erro ao carregar os detalhes do treino: ${error.message}</div>`;
    }
}

function getYouTubeVideoId(url) {
    // Regex atualizado para capturar links normais, curtos (youtu.be) e Shorts
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function renderWorkoutDetails(workout) {
    const videoId = getYouTubeVideoId(workout.workoutVideoLink);
    const videoEmbed = videoId ? `
                <div class="ratio ratio-16x9 rounded-3 shadow mb-4 bg-dark">
                    <iframe src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                </div>
            ` : `<div class="alert alert-warning text-center">Este treino não possui um link de vídeo válido.</div>`;

    workoutContent.innerHTML = `
                <div class="card shadow-sm p-4 mb-4 bg-custom-white">
                    <h3 class="card-title fw-bold text-custom-slate-800">${workout.workoutName}</h3>
                    <p class="card-text text-muted">${workout.workoutDescription}</p>
                </div>
                ${videoEmbed}
            `;
}