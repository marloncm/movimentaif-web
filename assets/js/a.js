import { auth, getAuthTokenAndFetch, API_BASE_URL } from "./firebaseConfig.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// const h1Element = document.getElementById('h1teste');
const uid = "aWfMihwKAWOdbokZ21gEmTJ4Xhg1"
const loadingSpinner = document.getElementById('loading-spinner');
const userNameElement = document.getElementById('user-name-title');
const selectTreino = document.getElementById('select-treino');
onAuthStateChanged(auth, user => {
    if (user) {
        // h1Element.textContent = "Novo Texto";
        const data = getWorkoutChartData(uid);
        data.then(async chartData => {
            userNameElement.textContent = await getUserName(uid);
            loadingSpinner.classList.add('d-none');
            showData();
            console.log(chartData);
        });
    } else {
        window.location.replace('index.html');
    }
});

async function getWorkoutChartData(userId) {
    try {
        console.log(API_BASE_URL);
        const chartUrl = `${API_BASE_URL}/charts/user/${userId}`;
        const response = await getAuthTokenAndFetch(chartUrl);

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching workout data:', error);
    }
}

async function getWorkouts() {
    try {
        const workoutsUrl = `${API_BASE_URL}/workouts`;
        const response = await getAuthTokenAndFetch(workoutsUrl);
        const data = await response.json();
        console.log(data);
        return data;
    } catch (error) {
        console.error('Error fetching workouts:', error);
    }
}

async function showData() {
    const workouts = await getWorkouts();
    workouts.forEach(workout => {
        const option = document.createElement('option');
        option.value = workout.workoutId;
        option.textContent = workout.workoutName;
        selectTreino.appendChild(option);
    });
}

async function getUserName(userId) {
    try {
        const userUrl = `http://localhost:8080/api/users/${userId}`;
        const response = await getAuthTokenAndFetch(userUrl);
        const data = await response.json();
        return data.userName;
    } catch (error) {
        console.error('Error fetching user data:', error);
    }
}