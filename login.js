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
                if (isAdmin) btnLogin.style.backgroundColor = "#dc2626"; 
            } else {
                btnLogin.innerText = "로그인";
                btnLogin.classList.remove("primary");
                btnLogin.style.backgroundColor = ""; 
            }
        };

        // [핵심 수정 1] 로그아웃 로직 강화 (try-finally 적용)
        btnLogin.onclick = async () => {
            if (currentUser) {
                const msg = isAdmin ? "관리자 계정에서 로그아웃 하시겠습니까?" : "로그아웃 하시겠습니까?";
                if (!confirm(msg)) return;

                btnLogin.innerText = "처리 중...";

                try {
                    // 배포 환경에서 브라우저 보안으로 인해 signOut이 차단되더라도
                    if (sb && sb.auth) {
                        await sb.auth.signOut();
                    }
                } catch (e) {
                    console.error("로그아웃 통신 오류(무시하고 진행):", e);
                } finally {
                    // 에러 여부와 관계없이 무조건 강제 새로고침하여 로그아웃 처리
                    window.location.reload(); 
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
        btnSwitch.onclick = () => {
            isSignUpMode = !isSignUpMode; // 상태 반전
            updateModalUI(); // UI 업데이트
        };
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
    
    // 5. 엔터키 입력 시 자동 실행 (모바일 키보드 호환성 위해 keydown 사용)
    const inputPw = document.getElementById("loginPw");
    if(inputPw) {
        inputPw.addEventListener("keydown", (e) => {
            if(e.key === 'Enter') {
                e.preventDefault(); // 모바일 줄바꿈 방지
                handleAuthAction();
            }
        });
    }
}

// 모달 열기 함수
function openLoginModal() {
    const modal = document.getElementById("loginModal");
    if (modal) {
        modal.style.display = "flex";
        
        // [핵심 수정 2] 모달 열 때 항상 '로그인' 모드로 초기화
        isSignUpMode = false; 
        updateModalUI(); 
        
        // [핵심 수정 3] 입력창 초기화 (테스트용 하드코딩 삭제됨)
        document.getElementById("loginId").value = "";
        document.getElementById("loginPw").value = "";
        const pwConfirm = document.getElementById("loginPwConfirm");
        if(pwConfirm) pwConfirm.value = "";
    }
}

// UI 업데이트 전용 함수 (상태에 따라 텍스트/보임 여부 변경)
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
            
            // Supabase 설정에 따라 data.session이 바로 들어오는 경우(이메일 인증 불필요)
            if (data.session) {
                alert("회원가입이 완료되었습니다! 자동 로그인됩니다.");
                location.reload();
            } else {
                alert("가입 확인 메일을 발송했습니다.\n이메일을 확인하여 인증을 완료해주세요! (인증 후 로그인 가능)");
                document.getElementById("loginModal").style.display = "none";
            }
            
        } else {
            // --- 로그인 ---
            const { data, error } = await sb.auth.signInWithPassword({
                email: email,
                password: password,
            });
            if (error) throw error;
            
            // 로그인 성공 시 새로고침
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
    const redirectUrl = window.location.origin; 
    
    const { data, error } = await sb.auth.signInWithOAuth({
        provider: provider,
        options: {
            redirectTo: redirectUrl, 
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            },
        },
    });

    if (error) alert(provider + " 로그인 실패: " + error.message);
}