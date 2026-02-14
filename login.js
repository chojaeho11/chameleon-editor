// login.js

import { sb, currentUser, isAdmin } from "./config.js?v=123";

let isSignUpMode = false; 

export function initAuth() {
    // 1. 메인 로그인 버튼 (초기화 시점 번역 적용)
    const btnLogin = document.getElementById("btnLoginBtn");
    if (btnLogin) {
        btnLogin.updateState = () => {
            if (currentUser) {
                // 관리자/일반 로그아웃 텍스트 처리
                btnLogin.innerText = isAdmin 
                    ? (window.t('btn_admin_logout', "Admin Logout")) 
                    : (window.t('btn_logout', "Logout"));
                
                btnLogin.classList.add("primary");
                if (isAdmin) btnLogin.style.backgroundColor = "#dc2626"; 
            } else {
                // 로그인 텍스트 처리
                btnLogin.innerText = window.t('btn_login', "Login");
                btnLogin.classList.remove("primary");
                btnLogin.style.backgroundColor = ""; 
            }
        };

        // 로그아웃 로직
        btnLogin.onclick = async () => {
            const t = window.translations || {}; // 클릭 시점 번역

            if (currentUser) {
                const msg = isAdmin 
                    ? (t['confirm_admin_logout'] || "관리자 계정에서 로그아웃 하시겠습니까?") 
                    : (t['confirm_logout'] || "로그아웃 하시겠습니까?");
                
                if (!confirm(msg)) return;

                btnLogin.innerText = t['msg_processing'] || "처리 중...";

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

    // 2. 모드 전환 버튼 (로그인 <-> 회원가입)
    const btnSwitch = document.getElementById("btnSwitchAuthMode");
    if (btnSwitch) {
        btnSwitch.onclick = () => {
            isSignUpMode = !isSignUpMode;
            updateModalUI();
        };
    }

    // 3. 실행 버튼 (로그인/가입하기 수행)
    const btnAuthAction = document.getElementById("btnAuthAction");
    if (btnAuthAction) {
        btnAuthAction.onclick = handleAuthAction;
    }

    // 4. 소셜 로그인
    const btnGoogle = document.getElementById("btnGoogleLogin");
    const btnKakao = document.getElementById("btnKakaoLogin");

    if (btnGoogle) btnGoogle.onclick = () => handleSocialLogin("google");
    if (btnKakao) btnKakao.onclick = () => handleSocialLogin("kakao");
    
    // 5. 엔터키 입력 처리
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
        isSignUpMode = false; // 기본은 로그인 모드로 열기
        updateModalUI(); 
        
        // 입력창 초기화
        const idInput = document.getElementById("loginId");
        const pwInput = document.getElementById("loginPw");
        const pwConfirm = document.getElementById("loginPwConfirm");
        
        if(idInput) idInput.value = "";
        if(pwInput) pwInput.value = "";
        if(pwConfirm) pwConfirm.value = "";
    }
}

// ★ 여기가 가장 중요한 수정 부분입니다 (모달 내부 텍스트 번역 적용)
function updateModalUI() {
    // 번역 데이터 가져오기
    const t = window.translations || {};

    const title = document.getElementById("authTitle");
    const actionBtn = document.getElementById("btnAuthAction");
    const switchText = document.getElementById("authSwitchText");
    const switchBtn = document.getElementById("btnSwitchAuthMode");
    const pwConfirm = document.getElementById("loginPwConfirm");

    if (isSignUpMode) {
        // [회원가입 모드]
        title.innerText = t['modal_signup_title'] || "회원가입";
        actionBtn.innerText = t['btn_signup_submit'] || "가입하기";
        switchText.innerText = t['msg_have_account'] || "이미 계정이 있으신가요?";
        switchBtn.innerText = t['btn_to_login'] || "로그인"; // 로그인으로 전환하는 버튼 텍스트
        
        if (pwConfirm) pwConfirm.style.display = "block";
    } else {
        // [로그인 모드]
        title.innerText = t['modal_login_title'] || "로그인";
        actionBtn.innerText = t['btn_login_submit'] || "로그인";
        switchText.innerText = t['msg_no_account'] || "계정이 없으신가요?";
        switchBtn.innerText = t['btn_to_signup'] || "회원가입"; // 회원가입으로 전환하는 버튼 텍스트
        
        if (pwConfirm) pwConfirm.style.display = "none";
    }
}

async function handleAuthAction() {
    // [수정] window.t 함수 사용
    const emailInput = document.getElementById("loginId");
    const pwInput = document.getElementById("loginPw");
    const pwConfirmInput = document.getElementById("loginPwConfirm");
    const email = emailInput?.value.trim();
    const password = pwInput?.value.trim();

    if (!email || !password) return alert(window.t('err_input_required', "Input required."));
    if (!sb) return alert(window.t('err_db_connection', "DB Error."));

    const btn = document.getElementById("btnAuthAction");
    const originalText = btn.innerText;
    btn.innerText = window.t('msg_processing', "Processing...");
    btn.disabled = true;

    try {
        if (isSignUpMode) {
            const pwConfirm = pwConfirmInput?.value.trim();
            if (password !== pwConfirm) throw new Error(t['err_pw_mismatch'] || "비밀번호 불일치");
            if (password.length < 6) throw new Error(t['err_pw_length'] || "비밀번호 6자리 이상");

            const { data, error } = await sb.auth.signUp({ email, password });
            if (error) throw error;
            
            if (data.session) {
                alert(t['msg_signup_success'] || "가입 완료!");
                location.reload();
            } else {
                alert(t['msg_verify_email'] || "인증 메일 발송됨");
                document.getElementById("loginModal").style.display = "none";
            }
        } else {
            const { data, error } = await sb.auth.signInWithPassword({ email, password });
            if (error) throw error;
            location.reload(); 
        }
    } catch (e) {
        const errPrefix = t['err_prefix'] || "오류: ";
        alert(errPrefix + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function handleSocialLogin(provider) {
    const t = window.translations || {};

    if (!sb) return alert(t['err_db_connection'] || "DB 미연결");
    const redirectUrl = window.location.origin; 
    const { data, error } = await sb.auth.signInWithOAuth({
        provider: provider,
        options: { redirectTo: redirectUrl, queryParams: { access_type: 'offline', prompt: 'consent' } },
    });
    
    if (error) {
        const errPrefix = t['err_login_fail'] || "로그인 실패: ";
        alert(errPrefix + error.message);
    }
}