// global_config.js
// 주의: 기존 config.js나 site-config.js 파일을 열어서 아래 두 값을 복사해 오셔야 합니다.
const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';

// Supabase 클라이언트 생성
export const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

export async function initConfig() {
    console.log("Config Initialized");
}