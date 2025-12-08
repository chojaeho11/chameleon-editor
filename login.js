import { sb, currentUser, isAdmin } from "./config.js";

let isSignUpMode = false; 

export function initAuth() {
    // 1. 메인 로그인 버튼 
    const btnLogin = document.getElementById("btnLoginBtn");
    if (btnLogin) {
        btnLogin.updateState = () => {
            if (currentUser) {
                btnLogin.innerText = isAdmin ? "관리자 로그아웃" : "로그아웃";
                btnLogin.classList.add("primary");
                if (isAdmin) btnLogin.style.backgroundColor = "#dc2626"; 
            } else {
                btnLogin.innerText = "로그인";
                btnLogin.classList.remove("primary");
                btnLogin.style.backgroundColor = ""; 
            }
        };

        // 로그아웃 로직 (강제 새로고침 포함)
        btnLogin.onclick = async () => {
            if (currentUser) {
                const msg = isAdmin ? "관리자 계정에서 로그아웃 하시겠습니까?" : "로그아웃 하시겠습니까?";
                if (!confirm(msg)) return;

                btnLogin.innerText = "처리 중...";

                try {
                    if (sb && sb.auth) {
                        await sb.auth.signOut();
                    }
                } catch (e) {
                    console.error("로그아웃 오류(무시):", e);
                } finally {
                    localStorage.clear();
                    sessionStorage.clear();
                    document.cookie.split(";").forEach((c) => {
                        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                    });
                    window.location.replace("/"); 
                }
            } else {
                openLoginModal();
            }
        };
        btnLogin.updateState();
    }

    // 2. 모드 전환 버튼
    const btnSwitch = document.getElementById("btnSwitchAuthMode");
    if (btnSwitch) {
        btnSwitch.onclick = () => {
            isSignUpMode = !isSignUpMode;
            updateModalUI();
        };
    }

    // 3. 실행 버튼
    const btnAuthAction = document.getElementById("btnAuthAction");
    if (btnAuthAction) {
        btnAuthAction.onclick = handleAuthAction;
    }

    // 4. 소셜 로그인
    const btnGoogle = document.getElementById("btnGoogleLogin");
    const btnKakao = document.getElementById("btnKakaoLogin");

    if (btnGoogle) btnGoogle.onclick = () => handleSocialLogin("google");
    if (btnKakao) btnKakao.onclick = () => handleSocialLogin("kakao");
    
    // 5. 엔터키
    const inputPw = document.getElementById("loginPw");
    if(inputPw) {
        inputPw.addEventListener("keydown", (e) => {
            if(e.key === 'Enter') {
                e.preventDefault(); 
                handleAuthAction();
            }
        });
    }
}

function openLoginModal() {
    const modal = document.getElementById("loginModal");
    if (modal) {
        modal.style.display = "flex";
        isSignUpMode = false; 
        updateModalUI(); 
        document.getElementById("loginId").value = "";
        document.getElementById("loginPw").value = "";
        const pwConfirm = document.getElementById("loginPwConfirm");
        if(pwConfirm) pwConfirm.value = "";
    }
}

function updateModalUI() {
    const title = document.getElementById("authTitle");
    const actionBtn = document.getElementById("btnAuthAction");
    const switchText = document.getElementById("authSwitchText");
    const switchBtn = document.getElementById("btnSwitchAuthMode");
    const pwConfirm = document.getElementById("loginPwConfirm");

    if (isSignUpMode) {
        title.innerText = "회원가입";
        actionBtn.innerText = "가입하기";
        switchText.innerText = "이미 계정이 있으신가요?";
        switchBtn.innerText = "로그인";
        if (pwConfirm) pwConfirm.style.display = "block";
    } else {
        title.innerText = "로그인";
        actionBtn.innerText = "로그인";
        switchText.innerText = "계정이 없으신가요?";
        switchBtn.innerText = "회원가입";
        if (pwConfirm) pwConfirm.style.display = "none";
    }
}

async function handleAuthAction() {
    const emailInput = document.getElementById("loginId");
    const pwInput = document.getElementById("loginPw");
    const pwConfirmInput = document.getElementById("loginPwConfirm");
    const email = emailInput?.value.trim();
    const password = pwInput?.value.trim();

    if (!email || !password) return alert("입력 정보 확인 필요");
    if (!sb) return alert("DB 연결 오류");

    const btn = document.getElementById("btnAuthAction");
    const originalText = btn.innerText;
    btn.innerText = "처리 중...";
    btn.disabled = true;

    try {
        if (isSignUpMode) {
            const pwConfirm = pwConfirmInput?.value.trim();
            if (password !== pwConfirm) throw new Error("비밀번호 불일치");
            if (password.length < 6) throw new Error("비밀번호 6자리 이상");

            const { data, error } = await sb.auth.signUp({ email, password });
            if (error) throw error;
            
            if (data.session) {
                alert("가입 완료!");
                location.reload();
            } else {
                alert("인증 메일 발송됨");
                document.getElementById("loginModal").style.display = "none";
            }
        } else {
            const { data, error } = await sb.auth.signInWithPassword({ email, password });
            if (error) throw error;
            location.reload(); 
        }
    } catch (e) {
        alert("오류: " + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function handleSocialLogin(provider) {
    if (!sb) return alert("DB 미연결");
    const redirectUrl = window.location.origin; 
    const { data, error } = await sb.auth.signInWithOAuth({
        provider: provider,
        options: { redirectTo: redirectUrl, queryParams: { access_type: 'offline', prompt: 'consent' } },
    });
    if (error) alert("로그인 실패: " + error.message);
}