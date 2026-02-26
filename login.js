// login.js

import { sb, currentUser, isAdmin } from "./config.js?v=123";

let isSignUpMode = false; 

export function initAuth() {
    // 1. 메인 로그인 버튼 (초기화 시점 번역 적용)
    const btnLogin = document.getElementById("btnLoginBtn");
    if (btnLogin) {
        btnLogin.updateState = () => {
            if (window.currentUser) {
                // 관리자/일반 로그아웃 텍스트 처리
                btnLogin.innerText = window.isAdmin
                    ? (window.t('btn_admin_logout', "Admin Logout"))
                    : (window.t('btn_logout', "Logout"));

                btnLogin.classList.add("primary");
                if (window.isAdmin) btnLogin.style.backgroundColor = "#dc2626";
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

            if (window.currentUser) {
                const msg = window.isAdmin
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
    const inputPwConfirm = document.getElementById("loginPwConfirm");
    if(inputPwConfirm) {
        inputPwConfirm.addEventListener("keydown", (e) => {
            if(e.key === 'Enter') {
                e.preventDefault();
                handleAuthAction();
            }
        });
    }

    // 6. 비밀번호 찾기 버튼
    const btnForgotPw = document.getElementById("btnForgotPw");
    if (btnForgotPw) {
        btnForgotPw.onclick = () => {
            document.getElementById("loginModal").style.display = "none";
            openResetPwModal();
        };
    }

    // 7. 비밀번호 재설정 모달 버튼들
    const btnSendReset = document.getElementById("btnSendResetEmail");
    if (btnSendReset) btnSendReset.onclick = handleForgotPassword;

    const btnBackToLogin = document.getElementById("btnBackToLogin");
    if (btnBackToLogin) {
        btnBackToLogin.onclick = () => {
            document.getElementById("resetPwModal").style.display = "none";
            openLoginModal();
        };
    }

    const btnChangePw = document.getElementById("btnChangePassword");
    if (btnChangePw) btnChangePw.onclick = handleResetPassword;
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

// ★ 전역 인증 모달 함수 (저장/결제 등에서 호출)
// mode: 'login' | 'signup', callback: 가입/로그인 성공 후 실행할 함수
window.openAuthModal = function(mode, callback) {
    if (callback) window._authCallback = callback;
    const modal = document.getElementById("loginModal");
    if (!modal) return;
    isSignUpMode = (mode === 'signup');
    updateModalUI();
    modal.style.display = "flex";
    // 입력창 초기화
    const idInput = document.getElementById("loginId");
    const pwInput = document.getElementById("loginPw");
    const pwConfirm = document.getElementById("loginPwConfirm");
    if(idInput) idInput.value = "";
    if(pwInput) pwInput.value = "";
    if(pwConfirm) pwConfirm.value = "";
};

// ★ 여기가 가장 중요한 수정 부분입니다 (모달 내부 텍스트 번역 적용)
function updateModalUI() {
    // 번역 데이터 가져오기
    const t = window.translations || {};

    const title = document.getElementById("authTitle");
    const actionBtn = document.getElementById("btnAuthAction");
    const switchText = document.getElementById("authSwitchText");
    const switchBtn = document.getElementById("btnSwitchAuthMode");
    const pwConfirm = document.getElementById("loginPwConfirm");
    const signupGuide = document.getElementById("signupGuide");
    const forgotPwLink = document.getElementById("forgotPwLink");

    const quickSignupBtn = document.getElementById("btnQuickSignup");
    const switchRow = document.getElementById("authSwitchRow");

    // ★ 번역 적용 (CDN 캐시로 data-i18n 미적용 대비)
    const loginId = document.getElementById("loginId");
    if (loginId && t['placeholder_id']) loginId.placeholder = t['placeholder_id'];
    if (quickSignupBtn && t['btn_quick_signup']) {
        const sp = quickSignupBtn.querySelector('span');
        if (sp) sp.innerText = t['btn_quick_signup'];
    }
    if (signupGuide) {
        const guideTitle = signupGuide.querySelector('div:first-child');
        const guideDesc = signupGuide.querySelector('div:last-child');
        if (guideTitle && t['signup_guide_title']) guideTitle.innerText = t['signup_guide_title'];
        if (guideDesc && t['signup_guide_desc']) guideDesc.innerHTML = t['signup_guide_desc'];
    }

    if (isSignUpMode) {
        // [회원가입 모드] — 아이디 + 비번 + 비번확인
        title.innerText = t['modal_signup_title'] || "회원가입";
        actionBtn.innerText = t['btn_signup_submit'] || "가입하기";
        if (switchRow) { switchRow.style.display = "block"; }
        if (switchText) switchText.innerText = t['msg_have_account'] || "이미 계정이 있으신가요?";
        if (switchBtn) switchBtn.innerText = t['btn_to_login'] || "로그인";

        if (pwConfirm) pwConfirm.style.display = "block"; // ★ 비번확인 표시
        if (signupGuide) signupGuide.style.display = "block"; // 간편가입 안내
        if (forgotPwLink) forgotPwLink.style.display = "none"; // 비번찾기 숨김
        if (quickSignupBtn) quickSignupBtn.style.display = "none"; // 1초 버튼 숨김
    } else {
        // [로그인 모드]
        title.innerText = t['modal_login_title'] || "로그인";
        actionBtn.innerText = t['btn_login_submit'] || "로그인";
        if (switchRow) { switchRow.style.display = "none"; }

        if (pwConfirm) pwConfirm.style.display = "none";
        if (signupGuide) signupGuide.style.display = "none";
        if (forgotPwLink) forgotPwLink.style.display = "block";
        if (quickSignupBtn) quickSignupBtn.style.display = "block"; // 1초 버튼 표시
    }
}

async function handleAuthAction() {
    // [수정] window.t 함수 사용
    const emailInput = document.getElementById("loginId");
    const pwInput = document.getElementById("loginPw");
    const pwConfirmInput = document.getElementById("loginPwConfirm");
    let email = emailInput?.value.trim();
    const password = pwInput?.value.trim();

    if (!email || !password) { showToast(window.t('err_input_required', "Input required."), "warn"); return; }
    if (!sb) { showToast(window.t('err_db_connection', "DB Error."), "error"); return; }

    // ★ '@' 없으면 자동으로 이메일 형식 생성 (간편 가입)
    if (!email.includes('@')) {
        email = email + '@cafe2626.com';
    }
    // ★ Supabase 최소 6자 요구 → 짧은 비번은 자동 패딩 (가입/로그인 모두 동일 처리)
    let paddedPassword = password;
    while (paddedPassword.length < 6) paddedPassword += '0';

    const btn = document.getElementById("btnAuthAction");
    const originalText = btn.innerText;
    btn.innerText = window.t('msg_processing', "Processing...");
    btn.disabled = true;

    try {
        if (isSignUpMode) {
            const pwConfirm = pwConfirmInput?.value.trim();
            if (password !== pwConfirm) throw new Error(window.t('err_pw_mismatch', "비밀번호가 일치하지 않습니다."));

            const siteCode = (window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) || 'KR';
            const { data, error } = await sb.auth.signUp({ email, password: paddedPassword });
            if (error) throw error;

            // 프로필에 가입 국가 저장
            if (data.user) {
                await sb.from('profiles').update({ site: siteCode }).eq('id', data.user.id);
            }

            // ★ 가입 즉시 로그인 처리
            let session = data.session;
            if (!session) {
                // 세션이 없으면 직접 로그인 시도
                const { data: loginData, error: loginErr } = await sb.auth.signInWithPassword({ email, password: paddedPassword });
                if (!loginErr && loginData.session) session = loginData.session;
            }
            if (session) {
                if (window.updateUserSession) window.updateUserSession(session);
            }
            showToast(window.t('msg_signup_success', "가입 완료!"), "success");
            document.getElementById("loginModal").style.display = "none";

            // 콜백 실행 (저장/결제 재시도)
            if (window._authCallback) {
                const cb = window._authCallback;
                window._authCallback = null;
                setTimeout(cb, 300);
            }
        } else {
            const { data, error } = await sb.auth.signInWithPassword({ email, password: paddedPassword });
            if (error) throw error;

            // ★ 새로고침 없이 세션 갱신
            if (window.updateUserSession) window.updateUserSession(data.session);

            showToast(t['msg_login_success'] || "로그인 완료!", "success");
            document.getElementById("loginModal").style.display = "none";

            // 콜백 실행 (저장/결제 재시도)
            if (window._authCallback) {
                const cb = window._authCallback;
                window._authCallback = null;
                setTimeout(cb, 300);
            }
        }
    } catch (e) {
        const errPrefix = t['err_prefix'] || "오류: ";
        showToast(errPrefix + e.message, "error");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function handleSocialLogin(provider) {
    const t = window.translations || {};

    if (!sb) { showToast(t['err_db_connection'] || "DB 미연결", "error"); return; }
    const redirectUrl = window.location.origin;
    const { data, error } = await sb.auth.signInWithOAuth({
        provider: provider,
        options: { redirectTo: redirectUrl, queryParams: { access_type: 'offline', prompt: 'consent' } },
    });

    if (error) {
        const errPrefix = t['err_login_fail'] || "로그인 실패: ";
        showToast(errPrefix + error.message, "error");
    }
}

// ── 비밀번호 재설정 모달 ──
function openResetPwModal() {
    const modal = document.getElementById("resetPwModal");
    if (!modal) return;
    // Step1 표시, Step2 숨기기
    const step1 = document.getElementById("resetPwStep1");
    const step2 = document.getElementById("resetPwStep2");
    if (step1) step1.style.display = "block";
    if (step2) step2.style.display = "none";
    // 입력 초기화
    const emailInput = document.getElementById("resetEmail");
    if (emailInput) emailInput.value = "";
    modal.style.display = "flex";
}

// 비밀번호 재설정 Step2 (새 비밀번호 입력) 표시
export function openResetPwStep2() {
    const modal = document.getElementById("resetPwModal");
    if (!modal) return;
    const step1 = document.getElementById("resetPwStep1");
    const step2 = document.getElementById("resetPwStep2");
    if (step1) step1.style.display = "none";
    if (step2) step2.style.display = "block";
    const newPw = document.getElementById("newPw");
    const newPwConfirm = document.getElementById("newPwConfirm");
    if (newPw) newPw.value = "";
    if (newPwConfirm) newPwConfirm.value = "";
    modal.style.display = "flex";
    // URL 해시 정리 (recovery 토큰 노출 방지)
    if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
}
// window에 노출 (config.js에서 접근 가능)
window.__openResetPwStep2 = openResetPwStep2;

// Step1: 이메일로 재설정 링크 발송
async function handleForgotPassword() {
    const email = document.getElementById("resetEmail")?.value.trim();
    if (!email) { showToast(window.t('err_input_required', "이메일을 입력해주세요."), "warn"); return; }
    if (!sb) { showToast(window.t('err_db_connection', "DB Error."), "error"); return; }

    const btn = document.getElementById("btnSendResetEmail");
    const originalText = btn.innerText;
    btn.innerText = window.t('msg_processing', "처리 중...");
    btn.disabled = true;

    try {
        const redirectUrl = window.location.origin;
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
        if (error) throw error;
        showToast(window.t('msg_reset_email_sent', "재설정 이메일을 발송했습니다. 메일함을 확인해주세요."), "success");
        document.getElementById("resetPwModal").style.display = "none";
    } catch (e) {
        showToast((window.t('err_prefix', "오류: ")) + e.message, "error");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Step2: 새 비밀번호로 변경
async function handleResetPassword() {
    const newPw = document.getElementById("newPw")?.value.trim();
    const newPwConfirm = document.getElementById("newPwConfirm")?.value.trim();

    if (!newPw || !newPwConfirm) { showToast(window.t('err_input_required', "비밀번호를 입력해주세요."), "warn"); return; }
    if (newPw !== newPwConfirm) { showToast(window.t('err_pw_mismatch', "비밀번호가 일치하지 않습니다."), "error"); return; }
    if (!sb) { showToast(window.t('err_db_connection', "DB Error."), "error"); return; }

    const btn = document.getElementById("btnChangePassword");
    const originalText = btn.innerText;
    btn.innerText = window.t('msg_processing', "처리 중...");
    btn.disabled = true;

    try {
        let paddedNewPw = newPw;
        while (paddedNewPw.length < 6) paddedNewPw += '0';
        const { error } = await sb.auth.updateUser({ password: paddedNewPw });
        if (error) throw error;
        showToast(window.t('msg_pw_changed', "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요."), "success");
        document.getElementById("resetPwModal").style.display = "none";
    } catch (e) {
        showToast((window.t('err_prefix', "오류: ")) + e.message, "error");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}