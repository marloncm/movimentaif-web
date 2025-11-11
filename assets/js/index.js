import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

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

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const googleLoginBtn = document.getElementById('google-login-btn');
const authMessage = document.getElementById('auth-message');
const provider = new GoogleAuthProvider();

function showMessage(message, isError = true) {
    authMessage.textContent = message;
    authMessage.classList.remove('d-none', 'alert-success', 'alert-danger');
    authMessage.classList.add(isError ? 'alert-danger' : 'alert-success');
}

/**
 * Envia dados do usuário para o backend. O backend deve ser responsável por
 * verificar se o usuário existe (UPSERT) ou criar um novo.
 * @param {Object} user Objeto UserCredential.user do Firebase.
 * @param {string} name Nome do usuário (necessário para o cadastro).
 * @param {string} email Email do usuário.
 * @returns {Promise<boolean>} True se a operação no backend for bem-sucedida.
 */
async function sendUserDataToBackend(user, name, email) {
    try {
        const idToken = await user.getIdToken();
        const backendUrl = "http://localhost:8080/api/users";

        const userData = {
            userId: user.uid,
            userName: name || user.displayName,
            email: email || user.email,
            role: "ADMIN"
        };

        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error('Falha no servidor. Verifique o console do backend.');
        }

        console.log("Dados do usuário enviados com sucesso para o backend.");
        return true;

    } catch (error) {
        console.error("Erro ao enviar dados para o backend:", error);
        showMessage("Erro ao comunicar com o servidor. Tente novamente mais tarde.");
        return false;
    }
}

// NOVO FLUXO PARA LOGIN/CADASTRO SOCIAL (GOOGLE)
async function handleSocialLogin(result) {
    const user = result.user;
    // 1. Tenta buscar o usuário no backend (Assumindo que você tem uma rota GET /api/users/{uid})
    try {
        const checkUrl = `http://localhost:8080/api/users/${user.uid}`;
        // Obtém o token, mesmo que o usuário seja novo, para autenticar a requisição GET
        const token = await user.getIdToken();

        const response = await fetch(checkUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            // 2. Se o usuário existir (status 200 OK), APENAS redireciona.
            window.location.href = 'agenda.html';
            return true;
        } else if (response.status === 404) {
            // 3. Se o usuário NÃO existir (status 404), CADASTRA.
            const success = await sendUserDataToBackend(user, user.displayName, user.email);
            if (success) {
                window.location.href = 'agenda.html';
                return true;
            }
        } else {
            // Lidar com outros erros (ex: 401, 500)
            throw new Error("Erro de servidor ao verificar usuário.");
        }
    } catch (error) {
        console.error("Erro no fluxo Google:", error);
        // Força o logout do Firebase, pois houve falha na criação/checagem do backend
        auth.signOut();
        showMessage("Falha na comunicação com o servidor. Tente novamente mais tarde.");
        return false;
    }
}


// Login E-MAIL/SENHA (Mantido, apenas redireciona)
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm['login-email'].value;
    const password = loginForm['login-password'].value;

    const loginBtn = loginForm.querySelector('button[type="submit"]');
    loginBtn.disabled = true;
    showMessage('Processando...', false);

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        // Após o login, a API deve ser chamada para garantir que o role/dados estão corretos.
        // Usaremos a mesma lógica do Google para simplificar: tentar buscar e, se não encontrar, cadastrar.
        await handleSocialLogin(userCredential);

    } catch (error) {
        console.error("Erro no login:", error);
        let message = "Erro no login. Verifique seu e-mail e senha.";
        if (error.code === 'auth/user-not-found') {
            message = "Nenhum usuário encontrado com este e-mail.";
        } else if (error.code === 'auth/wrong-password') {
            message = "Senha incorreta.";
        }
        showMessage(message);
    } finally {
        loginBtn.disabled = false;
    }
});

// CADASTRO (Mantido, envia para o backend)
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = registerForm['register-name'].value;
    const email = registerForm['register-email'].value;
    const password = registerForm['register-password'].value;

    if (password.length < 6) {
        showMessage("A senha deve ter no mínimo 6 caracteres.");
        return;
    }

    const registerBtn = registerForm.querySelector('button[type="submit"]');
    registerBtn.disabled = true;
    showMessage('Processando...', false);

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });

        // CRIAÇÃO DO USUÁRIO NO BACKEND (Apenas no cadastro)
        const success = await sendUserDataToBackend(userCredential.user, name, email);

        if (success) {
            showMessage("Cadastro realizado com sucesso! Redirecionando...", false);
            setTimeout(() => window.location.href = 'agenda.html', 2000);
        }
    } catch (error) {
        console.error("Erro no cadastro:", error);
        let message = "Erro no cadastro. Tente novamente.";
        if (error.code === 'auth/email-already-in-use') {
            message = "Este e-mail já está em uso.";
        }
        showMessage(message);
    } finally {
        registerBtn.disabled = false;
    }
});

// LOGIN GOOGLE (Implementação do NOVO FLUXO)
googleLoginBtn.addEventListener('click', async () => {
    const googleBtn = googleLoginBtn;
    googleBtn.disabled = true;
    showMessage('Processando...', false);

    try {
        const result = await signInWithPopup(auth, provider);
        await handleSocialLogin(result);

    } catch (error) {
        console.error("Erro com o login do Google:", error);
        showMessage("Erro ao entrar com o Google. Tente novamente.");
    } finally {
        googleBtn.disabled = false;
    }
});