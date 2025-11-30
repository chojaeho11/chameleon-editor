import { sb, currentUser, isAdmin } from "./config.js";

let isSignUpMode = false; // 현재 모드 상태 (false: 로그인, true: 회원가입)

export function initAuth() {
    // 1. 메인 로그인 버튼 (상단)
    const btnLogin = document.getElementById("btnLoginBtn");
    if (btnLogin) {
        btnLogin.updateState = () => {
            if (currentUser) {
                btnLogin.innerText = isAdmin ? "관리자 로그아웃" : "로그아웃";
                btnLogin.classList.add("primary");
                // 관리자라면 버튼 색상을 다르게 표시 (선택사항)
                if (isAdmin) btnLogin.style.backgroundColor = "#dc2626"; 
            } else {
                btnLogin.innerText = "로그인";
                btnLogin.classList.remove("primary");
                btnLogin.style.backgroundColor = ""; 
            }
        };

        btnLogin.onclick = () => {
            if (currentUser) {
                if (confirm(isAdmin ? "관리자 계정에서 로그아웃 하시겠습니까?" : "로그아웃 하시겠습니까?")) {
                    sb.auth.signOut().then(() => location.reload());
                }
            } else {
                openLoginModal();
            }
        };
        // 초기 상태 반영
        btnLogin.updateState();
    }

    // 2. 로그인/회원가입 모드 전환 버튼
    const btnSwitch = document.getElementById("btnSwitchAuthMode");
    if (btnSwitch) {
        btnSwitch.onclick = toggleAuthMode;
    }

    // 3. 실행 버튼 (로그인 또는 가입하기)
    const btnAuthAction = document.getElementById("btnAuthAction");
    if (btnAuthAction) {
        btnAuthAction.onclick = handleAuthAction;
    }

    // 4. 소셜 로그인 버튼 연결
    const btnGoogle = document.getElementById("btnGoogleLogin");
    const btnKakao = document.getElementById("btnKakaoLogin");

    if (btnGoogle) btnGoogle.onclick = () => handleSocialLogin("google");
    if (btnKakao) btnKakao.onclick = () => handleSocialLogin("kakao");
    
    // 5. 엔터키 입력 시 자동 실행
    const inputPw = document.getElementById("loginPw");
    if(inputPw) {
        inputPw.onkeyup = (e) => { if(e.key === 'Enter') handleAuthAction(); };
    }
}

function openLoginModal() {
    const modal = document.getElementById("loginModal");
    if (modal) {
        modal.style.display = "flex";
        // 모달 열 때 항상 로그인 모드로 초기화
        isSignUpMode = true; 
        toggleAuthMode(); 
        // ★ [테스트용] 여기에 아이디/비번 자동 입력 코드 추가
        document.getElementById("loginId").value = "whwogh11";
        document.getElementById("loginPw").value = "0529as";
    }
}
    

// 모드 전환 (로그인 <-> 회원가입)
function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    
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

// 이메일 로그인/가입 처리 로직
async function handleAuthAction() {
    const emailInput = document.getElementById("loginId");
    const pwInput = document.getElementById("loginPw");
    const pwConfirmInput = document.getElementById("loginPwConfirm");

    const email = emailInput?.value.trim();
    const password = pwInput?.value.trim();

    if (!email || !password) return alert("이메일과 비밀번호를 모두 입력해주세요.");
    if (!sb) return alert("DB 연결 오류: Supabase 설정이 필요합니다.");

    const btn = document.getElementById("btnAuthAction");
    const originalText = btn.innerText;
    btn.innerText = "처리 중...";
    btn.disabled = true;

    try {
        if (isSignUpMode) {
            // --- 회원가입 ---
            const pwConfirm = pwConfirmInput?.value.trim();
            if (password !== pwConfirm) throw new Error("비밀번호가 일치하지 않습니다.");
            if (password.length < 6) throw new Error("비밀번호는 6자리 이상이어야 합니다.");

            const { data, error } = await sb.auth.signUp({
                email: email,
                password: password,
            });
            if (error) throw error;
            
            alert("가입 확인 메일을 발송했습니다.\n이메일을 확인하여 인증을 완료해주세요! (인증 후 로그인 가능)");
            // 자동 로그인이 안 되는 설정일 수 있으므로 모달 닫기
            document.getElementById("loginModal").style.display = "none";
            
        } else {
            // --- 로그인 ---
            const { data, error } = await sb.auth.signInWithPassword({
                email: email,
                password: password,
            });
            if (error) throw error;
            
            // 관리자 로그인 체크는 config.js의 onAuthStateChange에서 처리됨
            location.reload(); 
        }
    } catch (e) {
        alert("오류: " + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// 소셜 로그인 처리
async function handleSocialLogin(provider) {
    if (!sb) return alert("DB 미연결");
    
    // 현재 URL (로그인 후 돌아올 주소)
    const redirectUrl = window.location.origin; // 예: https://your-site.com
    
    const { data, error } = await sb.auth.signInWithOAuth({
        provider: provider,
        options: {
            redirectTo: redirectUrl, 
            // 카카오의 경우 prompt 옵션 등이 필요할 수 있음
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            },
        },
    });

    if (error) alert(provider + " 로그인 실패: " + error.message);
    // OAuth는 자동으로 리다이렉트 되므로 추가 처리 불필요
}