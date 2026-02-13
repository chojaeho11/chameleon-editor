import { sb } from "./global_config.js";

// [공통] 로딩 화면 제어
export function showLoading(show) {
    const el = document.getElementById('loading');
    if(el) el.style.display = show ? 'flex' : 'none';
}

// [공통] 화폐 단위 포맷 (KRW → 현지 통화 환산 포함)
export const formatCurrency = (amount, siteCode) => {
    if (!amount) return '0';
    const rates = { 'KR': 1, 'JP': 0.2, 'US': 0.002, 'CN': 0.005, 'AR': 0.003, 'ES': 0.0007 };
    const rate = rates[siteCode] || 1;
    const converted = amount * rate;
    if (siteCode === 'JP') return '¥' + Math.floor(converted).toLocaleString();
    if (siteCode === 'US') return '$' + Math.round(converted).toLocaleString();
    if (siteCode === 'CN') return '¥' + Math.round(converted).toLocaleString();
    if (siteCode === 'AR') return Math.round(converted).toLocaleString() + ' ﷼';
    if (siteCode === 'ES') return '€' + converted.toFixed(2);
    return converted.toLocaleString() + '원';
}

// [보안] 관리자 권한 체크
export async function checkAdminAccess() {
    const { data: { session } } = await sb.auth.getSession();
    
    if (!session) {
        alert("관리자 로그인이 필요합니다.");
        window.location.replace("index.html"); 
        return false;
    }

    const { data: profile, error } = await sb.from('profiles').select('role').eq('id', session.user.id).single();
    
    if (error || !profile || profile.role !== 'admin') {
        alert("접근 권한이 없습니다.");
        await sb.auth.signOut(); 
        window.location.replace("index.html");
        return false;
    }

    document.body.style.visibility = 'visible';
    return true;
}

// 전역 함수 등록
window.logout = async () => { if(confirm("로그아웃 하시겠습니까?")) { await sb.auth.signOut(); location.href = "index.html"; } };
window.closeModal = (id) => {
    const el = document.getElementById(id || 'fileManagerModal');
    if(el) el.style.display = 'none';
};
window.showLoading = showLoading;
window.formatCurrency = formatCurrency;