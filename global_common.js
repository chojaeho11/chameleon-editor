import { sb } from "./global_config.js?v=290";

// [공통] 로딩 화면 제어
export function showLoading(show) {
    const el = document.getElementById('loading');
    if(el) el.style.display = show ? 'flex' : 'none';
}

// [공통] 화폐 단위 포맷 (KRW → 현지 통화 환산 포함)
export const formatCurrency = (amount, siteCode) => {
    if (!amount) return '0';
    const rates = { 'KR': 1, 'JP': 0.1, 'US': 0.001, 'CN': 0.05, 'AR': 0.001, 'ES': 0.001, 'DE': 0.001, 'FR': 0.001 };
    const rate = rates[siteCode] || 1;
    const converted = amount * rate;
    if (siteCode === 'JP') return '¥' + Math.floor(converted).toLocaleString();
    if (siteCode === 'US') return converted >= 10 ? '$' + Math.round(converted).toLocaleString() : '$' + converted.toFixed(2);
    if (siteCode === 'CN') return '¥' + Math.round(converted).toLocaleString();
    if (siteCode === 'AR') return '$' + (converted >= 10 ? Math.round(converted).toLocaleString() : converted.toFixed(2));
    if (siteCode === 'ES' || siteCode === 'DE' || siteCode === 'FR') return '€' + converted.toFixed(2);
    if (siteCode === 'KR' || !siteCode) return converted.toLocaleString() + '원';
    return '$' + (converted < 1 ? converted.toFixed(2) : Math.round(converted).toLocaleString());
}

// [보안] 관리자 권한 체크
export async function checkAdminAccess() {
    const { data: { session } } = await sb.auth.getSession();
    
    if (!session) {
        showToast("관리자 로그인이 필요합니다.", "error");
        window.location.replace("index.html");
        return false;
    }

    const { data: profile, error } = await sb.from('profiles').select('role').eq('id', session.user.id).single();
    
    if (error || !profile || profile.role !== 'admin') {
        showToast("접근 권한이 없습니다.", "error");
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