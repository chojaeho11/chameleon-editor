"""
Cotton Pattern Studio — GUI Launcher
====================================
fabric_pattern_generator.py를 GUI로 조작하는 데스크톱 앱.
Tkinter(파이썬 기본 내장)로 만들어 추가 설치 불필요.

기능:
- API 키 입력/저장 (.env에 자동 기록)
- 카테고리 체크박스 (8개)
- 라운드/대기시간/카테고리당 수량 조절
- 실시간 로그 출력
- 시작/중단 버튼
- 마지막 설정 자동 기억

실행: python pattern_studio_gui.py
또는 start_studio.bat 더블클릭
"""

import os
import sys
import json
import queue
import webbrowser
import threading
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict

import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox, filedialog

# ── 외부 링크 ──
SUPABASE_SECRETS_URL = "https://supabase.com/dashboard/project/qinvtnhiidtmrzosyvys/functions/secrets"
SUPABASE_API_KEYS_URL = "https://supabase.com/dashboard/project/qinvtnhiidtmrzosyvys/settings/api"
OPENAI_KEYS_URL = "https://platform.openai.com/api-keys"


HERE = Path(__file__).parent.resolve()
ENV_FILE = HERE / ".env"
CONFIG_FILE = HERE / ".gui_config.json"
GENERATOR_SCRIPT = HERE / "fabric_pattern_generator.py"

CATEGORIES = [
    ("animal", "🐾 동물"),
    ("plant", "🌿 식물"),
    ("people", "👤 사람"),
    ("modern", "▲ 모던"),
    ("scenery", "🏔 풍경"),
    ("typo", "Aa 타이포"),
    ("kids", "🧸 키즈"),
    ("etc", "✨ 기타"),
]

COLORS = {
    "bg": "#faf6ed",
    "card": "#ffffff",
    "border": "#e5dfd1",
    "brown": "#451a03",
    "brown_light": "#78350f",
    "accent": "#b45309",
    "yellow": "#fde047",
    "ink": "#1e293b",
    "muted": "#94a3b8",
    "success": "#16a34a",
    "danger": "#dc2626",
    "log_bg": "#0f172a",
    "log_fg": "#cbd5e1",
}


# ============================================================
# .env 읽기/쓰기
# ============================================================
def read_env() -> dict:
    if not ENV_FILE.exists():
        return {}
    data = {}
    try:
        text = ENV_FILE.read_text(encoding="utf-8-sig")  # BOM 있으면 자동 제거
    except Exception:
        text = ENV_FILE.read_text(encoding="utf-8", errors="replace")
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip()
        # 따옴표로 감싸진 값 풀기
        if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
            v = v[1:-1]
        data[k.strip()] = v
    return data


def write_env(data: dict):
    """값을 따옴표로 감싸서 저장 — 공백/특수문자 안전. 입력값은 양끝 공백/개행 제거."""
    def q(v):
        v = (v or "").strip().replace("\r", "").replace("\n", "")
        # 내부 따옴표 이스케이프
        v = v.replace('"', '\\"')
        return f'"{v}"'

    lines = [
        "# Cotton Pattern Studio - auto-generated, do not commit",
        f"OPENAI_API_KEY={q(data.get('OPENAI_API_KEY'))}",
        f"SUPABASE_URL={q(data.get('SUPABASE_URL', 'https://qinvtnhiidtmrzosyvys.supabase.co'))}",
        f"SUPABASE_SERVICE_KEY={q(data.get('SUPABASE_SERVICE_KEY'))}",
    ]
    # 끝에 줄바꿈 보장 (BOM 없이 UTF-8)
    ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def read_config() -> dict:
    if not CONFIG_FILE.exists():
        return {}
    try:
        return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def write_config(data: dict):
    try:
        CONFIG_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


# ============================================================
# 메인 GUI
# ============================================================
class PatternStudioApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Cotton Pattern Studio · AI 패턴 자동 생성기")
        self.geometry("900x780")
        self.minsize(820, 720)
        self.configure(bg=COLORS["bg"])

        self.proc: Optional[subprocess.Popen] = None
        self.reader_thread: Optional[threading.Thread] = None
        self.log_queue: queue.Queue = queue.Queue()
        self.cat_vars: Dict[str, tk.BooleanVar] = {}

        self._build_styles()
        self._build_ui()
        self._load_saved()
        self.after(100, self._drain_log_queue)
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    # ──────────── 스타일 ────────────
    def _build_styles(self):
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure("TFrame", background=COLORS["bg"])
        style.configure("Card.TFrame", background=COLORS["card"], relief="flat")
        style.configure("TLabel", background=COLORS["bg"], foreground=COLORS["ink"], font=("Segoe UI", 10))
        style.configure("Card.TLabel", background=COLORS["card"], foreground=COLORS["ink"], font=("Segoe UI", 10))
        style.configure("Heading.TLabel", background=COLORS["bg"], foreground=COLORS["brown"],
                        font=("Segoe UI", 11, "bold"))
        style.configure("Title.TLabel", background=COLORS["bg"], foreground=COLORS["brown"],
                        font=("Georgia", 22, "bold"))
        style.configure("Sub.TLabel", background=COLORS["bg"], foreground=COLORS["muted"],
                        font=("Segoe UI", 9))
        style.configure("TCheckbutton", background=COLORS["card"], foreground=COLORS["ink"],
                        font=("Segoe UI", 10))
        style.map("TCheckbutton", background=[("active", COLORS["card"])])
        style.configure("TEntry", fieldbackground=COLORS["card"], foreground=COLORS["ink"],
                        bordercolor=COLORS["border"])
        style.configure("TSpinbox", fieldbackground=COLORS["card"], foreground=COLORS["ink"])
        style.configure("Start.TButton", background=COLORS["brown"], foreground=COLORS["yellow"],
                        font=("Segoe UI", 12, "bold"), borderwidth=0, padding=(28, 12))
        style.map("Start.TButton",
                  background=[("active", COLORS["brown_light"]), ("disabled", "#9ca3af")],
                  foreground=[("disabled", "#e5e7eb")])
        style.configure("Stop.TButton", background=COLORS["danger"], foreground="#fff",
                        font=("Segoe UI", 12, "bold"), borderwidth=0, padding=(28, 12))
        style.map("Stop.TButton",
                  background=[("active", "#b91c1c"), ("disabled", "#9ca3af")])
        style.configure("Save.TButton", background=COLORS["accent"], foreground="#fff",
                        font=("Segoe UI", 9, "bold"), borderwidth=0, padding=(12, 6))
        style.map("Save.TButton", background=[("active", COLORS["brown"])])

    # ──────────── UI ────────────
    def _build_ui(self):
        # 헤더
        header = ttk.Frame(self, padding=(20, 18, 20, 6))
        header.pack(fill="x")
        ttk.Label(header, text="🎨 COTTON PATTERN STUDIO", style="Title.TLabel").pack(anchor="w")
        ttk.Label(header,
                  text="OpenAI gpt-image-1으로 좌우/상하 이어지는 패브릭 패턴을 자동 생성하고 코튼프린트에 등록합니다.",
                  style="Sub.TLabel").pack(anchor="w", pady=(2, 0))

        # 본문
        body = ttk.Frame(self, padding=(20, 6, 20, 8))
        body.pack(fill="both", expand=True)
        body.columnconfigure(0, weight=1)
        body.columnconfigure(1, weight=1)

        # ─── 좌측: API 키 + 옵션 ───
        left = ttk.Frame(body)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 8))

        # API 키 카드
        keys_card = self._make_card(left, "🔑 API 키 (한 번만 입력 → 자동 저장)")
        keys_card.pack(fill="x", pady=(0, 10))

        # OpenAI Key
        oai_row = ttk.Frame(keys_card, style="Card.TFrame")
        oai_row.pack(fill="x", padx=14, pady=(8, 2))
        ttk.Label(oai_row, text="OpenAI API Key", style="Card.TLabel").pack(side="left")
        ttk.Button(oai_row, text="🌐 Supabase에서 복사", command=lambda: webbrowser.open(SUPABASE_SECRETS_URL),
                   style="Save.TButton").pack(side="right")
        ttk.Button(oai_row, text="🌐 OpenAI에서 발급", command=lambda: webbrowser.open(OPENAI_KEYS_URL),
                   style="Save.TButton").pack(side="right", padx=(0, 4))
        self.openai_var = tk.StringVar()
        self.openai_entry = ttk.Entry(keys_card, textvariable=self.openai_var, show="•", width=50)
        self.openai_entry.pack(fill="x", padx=14, pady=(0, 8))

        # Supabase Key
        sb_row = ttk.Frame(keys_card, style="Card.TFrame")
        sb_row.pack(fill="x", padx=14, pady=(2, 2))
        ttk.Label(sb_row, text="Supabase Service Role Key (anon 아님!)", style="Card.TLabel").pack(side="left")
        ttk.Button(sb_row, text="🌐 Supabase에서 복사", command=lambda: webbrowser.open(SUPABASE_API_KEYS_URL),
                   style="Save.TButton").pack(side="right")
        self.sb_var = tk.StringVar()
        self.sb_entry = ttk.Entry(keys_card, textvariable=self.sb_var, show="•", width=50)
        self.sb_entry.pack(fill="x", padx=14, pady=(0, 8))

        # 안내 문구
        note = tk.Label(keys_card,
                        text="ℹ Supabase Edge Secrets는 보안상 외부 자동 조회 불가합니다.\n"
                             "  '🌐 Supabase에서 복사' 버튼을 누르면 페이지가 열립니다.\n"
                             "  → OPENAI_API_KEY 행 우측 ⋮ 메뉴 → Reveal → 복사 → 위에 붙여넣기.",
                        bg=COLORS["card"], fg=COLORS["muted"],
                        font=("Segoe UI", 8), anchor="w", justify="left")
        note.pack(fill="x", padx=14, pady=(0, 4))

        key_btns = ttk.Frame(keys_card, style="Card.TFrame")
        key_btns.pack(fill="x", padx=14, pady=(0, 12))
        ttk.Button(key_btns, text="👁 키 보기", command=self._toggle_key_visibility,
                   style="Save.TButton").pack(side="left")
        ttk.Button(key_btns, text="💾 .env에 저장", command=self._save_keys,
                   style="Save.TButton").pack(side="left", padx=(8, 0))
        ttk.Button(key_btns, text="🖥 바탕화면 바로가기 만들기", command=self._install_shortcut,
                   style="Save.TButton").pack(side="right")

        # 옵션 카드
        opts_card = self._make_card(left, "⚙ 실행 옵션")
        opts_card.pack(fill="x", pady=(0, 10))

        opts_grid = ttk.Frame(opts_card, style="Card.TFrame")
        opts_grid.pack(fill="x", padx=14, pady=12)
        opts_grid.columnconfigure(1, weight=1)

        ttk.Label(opts_grid, text="라운드 수 (0 = 무한)", style="Card.TLabel").grid(row=0, column=0, sticky="w", pady=4)
        self.rounds_var = tk.IntVar(value=0)
        ttk.Spinbox(opts_grid, from_=0, to=9999, textvariable=self.rounds_var, width=10).grid(row=0, column=1, sticky="e", pady=4)

        ttk.Label(opts_grid, text="라운드당 카테고리별 장수", style="Card.TLabel").grid(row=1, column=0, sticky="w", pady=4)
        self.percat_var = tk.IntVar(value=1)
        ttk.Spinbox(opts_grid, from_=1, to=20, textvariable=self.percat_var, width=10).grid(row=1, column=1, sticky="e", pady=4)

        ttk.Label(opts_grid, text="이미지 사이 대기 (초)", style="Card.TLabel").grid(row=2, column=0, sticky="w", pady=4)
        self.sleep_var = tk.IntVar(value=8)
        ttk.Spinbox(opts_grid, from_=0, to=600, textvariable=self.sleep_var, width=10).grid(row=2, column=1, sticky="e", pady=4)

        ttk.Label(opts_grid, text="이미지 품질", style="Card.TLabel").grid(row=3, column=0, sticky="w", pady=4)
        self.quality_var = tk.StringVar(value="medium")
        quality_combo = ttk.Combobox(opts_grid, textvariable=self.quality_var,
                                      values=["low", "medium", "high"],
                                      state="readonly", width=8)
        quality_combo.grid(row=3, column=1, sticky="e", pady=4)

        self.dryrun_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(opts_grid, text="Dry-run (로컬 저장만, 등록 안 함)",
                        variable=self.dryrun_var).grid(row=4, column=0, columnspan=2, sticky="w", pady=(8, 0))

        # 비용 안내 — 품질에 따라 동적 갱신
        self.cost_label = ttk.Label(opts_card,
                               text="",
                               style="Card.TLabel", foreground=COLORS["accent"], font=("Segoe UI", 9, "italic"))
        self.cost_label.pack(anchor="w", padx=14, pady=(0, 12))
        def _update_cost(*_):
            info = {
                "low":    "💰 low · ~$0.01/장 · ~10초/장 · 시간당 ~250장 (디테일 적음)",
                "medium": "💰 medium · ~$0.04/장 · ~30-60초/장 · 시간당 ~60-100장 (권장)",
                "high":   "💰 high · ~$0.17/장 · ~90-180초/장 · 시간당 ~20-40장 (최고 품질)",
            }
            self.cost_label.config(text=info.get(self.quality_var.get(), ""))
        quality_combo.bind("<<ComboboxSelected>>", _update_cost)
        _update_cost()

        # ─── 우측: 카테고리 ───
        right = ttk.Frame(body)
        right.grid(row=0, column=1, sticky="nsew", padx=(8, 0))

        cats_card = self._make_card(right, "📂 활성 카테고리")
        cats_card.pack(fill="both", expand=True)

        cat_grid = ttk.Frame(cats_card, style="Card.TFrame")
        cat_grid.pack(fill="both", expand=True, padx=14, pady=10)
        for i, (code, label) in enumerate(CATEGORIES):
            v = tk.BooleanVar(value=True)
            self.cat_vars[code] = v
            cb = ttk.Checkbutton(cat_grid, text=label, variable=v)
            cb.grid(row=i // 2, column=i % 2, sticky="w", padx=4, pady=6)
        cat_grid.columnconfigure(0, weight=1)
        cat_grid.columnconfigure(1, weight=1)

        all_btns = ttk.Frame(cats_card, style="Card.TFrame")
        all_btns.pack(fill="x", padx=14, pady=(0, 12))
        ttk.Button(all_btns, text="전체 선택", command=lambda: self._set_all_cats(True),
                   style="Save.TButton").pack(side="left")
        ttk.Button(all_btns, text="전체 해제", command=lambda: self._set_all_cats(False),
                   style="Save.TButton").pack(side="left", padx=(8, 0))

        # ─── 시작/중단 + 상태 ───
        ctrl = ttk.Frame(self, padding=(20, 4, 20, 8))
        ctrl.pack(fill="x")
        self.start_btn = ttk.Button(ctrl, text="▶  시작", command=self._start, style="Start.TButton")
        self.start_btn.pack(side="left")
        self.stop_btn = ttk.Button(ctrl, text="■  중단", command=self._stop, style="Stop.TButton", state="disabled")
        self.stop_btn.pack(side="left", padx=(10, 0))

        self.status_var = tk.StringVar(value="대기 중")
        ttk.Label(ctrl, textvariable=self.status_var,
                  font=("Segoe UI", 10, "bold"), foreground=COLORS["brown_light"]).pack(side="right")

        # ─── 로그 ───
        log_frame = ttk.Frame(self, padding=(20, 4, 20, 16))
        log_frame.pack(fill="both", expand=True)
        ttk.Label(log_frame, text="📜 실시간 로그", style="Heading.TLabel").pack(anchor="w", pady=(0, 4))

        self.log = scrolledtext.ScrolledText(
            log_frame, wrap="word", height=14,
            background=COLORS["log_bg"], foreground=COLORS["log_fg"],
            font=("Consolas", 9), borderwidth=0, padx=10, pady=8,
            insertbackground=COLORS["log_fg"]
        )
        self.log.pack(fill="both", expand=True)
        self.log.tag_config("ok", foreground="#86efac")
        self.log.tag_config("err", foreground="#fca5a5")
        self.log.tag_config("dim", foreground="#64748b")
        self.log.tag_config("info", foreground="#93c5fd")
        self._log_line("Cotton Pattern Studio 준비 완료. API 키 입력 후 ▶ 시작 버튼을 누르세요.", "info")

    def _make_card(self, parent, title: str) -> ttk.Frame:
        outer = ttk.Frame(parent, style="Card.TFrame")
        # tk.Label의 pady/padx는 단일 정수만 받음 — 비대칭 패딩은 .pack()에서 적용
        title_lbl = tk.Label(outer, text=title, bg=COLORS["card"], fg=COLORS["brown"],
                             font=("Segoe UI", 11, "bold"), anchor="w", padx=14)
        title_lbl.pack(fill="x", pady=(10, 0))
        return outer

    # ──────────── 데이터 ────────────
    def _load_saved(self):
        env = read_env()
        self.openai_var.set(env.get("OPENAI_API_KEY", ""))
        self.sb_var.set(env.get("SUPABASE_SERVICE_KEY", ""))

        cfg = read_config()
        if "rounds" in cfg: self.rounds_var.set(cfg["rounds"])
        if "per_category" in cfg: self.percat_var.set(cfg["per_category"])
        if "sleep" in cfg: self.sleep_var.set(cfg["sleep"])
        if "quality" in cfg: self.quality_var.set(cfg["quality"])
        if "dry_run" in cfg: self.dryrun_var.set(cfg["dry_run"])
        if "categories" in cfg:
            for code, v in self.cat_vars.items():
                v.set(code in cfg["categories"])

    def _save_config(self):
        write_config({
            "rounds": self.rounds_var.get(),
            "per_category": self.percat_var.get(),
            "sleep": self.sleep_var.get(),
            "quality": self.quality_var.get(),
            "dry_run": self.dryrun_var.get(),
            "categories": [c for c, v in self.cat_vars.items() if v.get()],
        })

    def _save_keys(self):
        # 양끝 공백/개행 + 사용자가 실수로 따옴표 채로 붙여넣은 경우도 제거
        def clean(s):
            s = (s or "").strip().strip('"').strip("'").strip()
            return s.replace("\r", "").replace("\n", "")
        oai = clean(self.openai_var.get())
        sb = clean(self.sb_var.get())
        # 정리된 값을 입력칸에도 다시 반영 (사용자가 시각적으로 확인 가능)
        self.openai_var.set(oai)
        self.sb_var.set(sb)
        if not oai or not oai.startswith("sk-"):
            messagebox.showwarning("OpenAI 키 확인", "OpenAI API 키는 보통 'sk-'로 시작합니다.")
        if not sb or not sb.startswith("eyJ"):
            messagebox.showwarning("Supabase 키 확인", "Supabase service_role 키는 'eyJ'로 시작합니다 (JWT).")
        write_env({
            "OPENAI_API_KEY": oai,
            "SUPABASE_URL": "https://qinvtnhiidtmrzosyvys.supabase.co",
            "SUPABASE_SERVICE_KEY": sb,
        })
        self._log_line(f"✓ .env 저장 완료: {ENV_FILE}", "ok")
        self.status_var.set(".env 저장됨")

    def _toggle_key_visibility(self):
        showing = self.openai_entry.cget("show") == ""
        new_show = "•" if showing else ""
        self.openai_entry.config(show=new_show)
        self.sb_entry.config(show=new_show)

    def _install_shortcut(self):
        """바탕화면에 'Cotton Pattern Studio' 바로가기 생성"""
        if os.name != "nt":
            messagebox.showinfo("알림", "Windows에서만 동작합니다.")
            return
        installer = HERE / "install_desktop_shortcut.py"
        if not installer.exists():
            messagebox.showerror("파일 누락", f"{installer.name}을 찾을 수 없습니다.")
            return
        try:
            # 자식 프로세스 stdout이 UTF-8로 출력되도록
            env = os.environ.copy()
            env["PYTHONIOENCODING"] = "utf-8"
            env["PYTHONUTF8"] = "1"
            res = subprocess.run(
                [sys.executable, str(installer)],
                cwd=str(HERE),
                capture_output=True, text=True, encoding="utf-8", errors="replace",
                timeout=20,
                env=env,
            )
            if res.returncode == 0:
                self._log_line("✓ 바탕화면 바로가기 생성됨", "ok")
                messagebox.showinfo("완료", "바탕화면에 'Cotton Pattern Studio' 바로가기를 만들었습니다.\n"
                                            "다음부터는 더블클릭으로 바로 실행할 수 있습니다.")
            else:
                err = (res.stderr or res.stdout or "").strip()
                self._log_line(f"✗ 바로가기 생성 실패:\n{err}", "err")
                messagebox.showerror("실패", err or "알 수 없는 에러")
        except Exception as e:
            self._log_line(f"✗ 바로가기 생성 실패: {e}", "err")
            messagebox.showerror("실패", str(e))

    def _set_all_cats(self, value: bool):
        for v in self.cat_vars.values():
            v.set(value)

    # ──────────── 실행 ────────────
    def _start(self):
        if self.proc and self.proc.poll() is None:
            return
        if not self.openai_var.get().strip() or not self.sb_var.get().strip():
            messagebox.showerror("키 누락", "OpenAI 키와 Supabase Service 키를 둘 다 입력해주세요.\n입력 후 '💾 .env에 저장' 버튼도 눌러야 합니다.")
            return
        if not ENV_FILE.exists():
            res = messagebox.askyesno("자동 저장", ".env 파일이 없습니다. 입력한 키를 지금 저장할까요?")
            if not res:
                return
            self._save_keys()

        cats = [c for c, v in self.cat_vars.items() if v.get()]
        if not cats:
            messagebox.showerror("카테고리 선택", "최소 1개 이상의 카테고리를 선택하세요.")
            return

        self._save_config()

        cmd = [
            sys.executable, "-u", str(GENERATOR_SCRIPT),
            "--rounds", str(self.rounds_var.get()),
            "--per-category", str(self.percat_var.get()),
            "--sleep", str(self.sleep_var.get()),
            "--quality", self.quality_var.get(),
            "--categories", *cats,
        ]
        if self.dryrun_var.get():
            cmd.append("--dry-run")

        self._log_line("─" * 64, "dim")
        self._log_line(f"▶ 시작: {datetime.now().strftime('%H:%M:%S')}", "info")
        self._log_line(f"   카테고리: {', '.join(cats)}", "dim")
        self._log_line(f"   라운드: {self.rounds_var.get() or '무한'} · 라운드당 {self.percat_var.get()}장 × {len(cats)}카테고리", "dim")
        if self.dryrun_var.get():
            self._log_line("   ⚠ Dry-run 모드 — 등록 안 함", "info")
        self._log_line("─" * 64, "dim")

        try:
            # CREATE_NO_WINDOW로 콘솔창 안 뜨게 (Windows)
            creationflags = 0
            if os.name == "nt":
                creationflags = subprocess.CREATE_NO_WINDOW
            # 자식 프로세스 stdout이 UTF-8로 출력되도록 환경변수 강제
            env = os.environ.copy()
            env["PYTHONIOENCODING"] = "utf-8"
            env["PYTHONUTF8"] = "1"
            self.proc = subprocess.Popen(
                cmd,
                cwd=str(HERE),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                creationflags=creationflags,
                env=env,
            )
        except Exception as e:
            self._log_line(f"✗ 실행 실패: {e}", "err")
            return

        self.start_btn.config(state="disabled")
        self.stop_btn.config(state="normal")
        self.status_var.set("실행 중…")

        self.reader_thread = threading.Thread(target=self._read_proc, daemon=True)
        self.reader_thread.start()

    def _stop(self):
        if not self.proc:
            return
        try:
            self.proc.terminate()
            self._log_line("⏹ 중단 요청…", "info")
        except Exception:
            pass

    def _read_proc(self):
        if not self.proc or not self.proc.stdout:
            return
        for line in self.proc.stdout:
            self.log_queue.put(("plain", line.rstrip()))
        self.proc.wait()
        self.log_queue.put(("done", self.proc.returncode))

    def _drain_log_queue(self):
        try:
            while True:
                kind, payload = self.log_queue.get_nowait()
                if kind == "plain":
                    tag = "plain"
                    line = payload
                    # 간단한 컬러링
                    if "✓" in line or "🎉" in line or "성공" in line:
                        tag = "ok"
                    elif "✗" in line or "실패" in line or "Error" in line or "error" in line:
                        tag = "err"
                    elif line.startswith("┏") or line.startswith("┗") or line.startswith("─") or line.startswith("="):
                        tag = "dim"
                    elif line.strip().startswith("[") or "ROUND" in line:
                        tag = "info"
                    self._log_line(line, tag)
                elif kind == "done":
                    rc = payload
                    msg = "✓ 정상 종료" if rc == 0 else f"⏹ 종료 (코드 {rc})"
                    self._log_line(msg, "info")
                    self.start_btn.config(state="normal")
                    self.stop_btn.config(state="disabled")
                    self.status_var.set("대기 중")
                    self.proc = None
        except queue.Empty:
            pass
        self.after(120, self._drain_log_queue)

    def _log_line(self, text: str, tag: str = "plain"):
        self.log.insert("end", text + "\n", tag if tag != "plain" else ())
        self.log.see("end")

    def _on_close(self):
        if self.proc and self.proc.poll() is None:
            if not messagebox.askyesno("종료 확인", "생성 중입니다. 정말 종료하시겠습니까?"):
                return
            try:
                self.proc.terminate()
            except Exception:
                pass
        self._save_config()
        self.destroy()


if __name__ == "__main__":
    if not GENERATOR_SCRIPT.exists():
        messagebox.showerror("파일 누락", f"fabric_pattern_generator.py를 찾을 수 없습니다:\n{GENERATOR_SCRIPT}")
        sys.exit(1)
    PatternStudioApp().mainloop()
