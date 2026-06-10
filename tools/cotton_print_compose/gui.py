#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cotton Print GUI — 패브릭 인쇄 데이터 생성기 (Tkinter)
=====================================================

작업지시서 주문번호만 입력하면 인쇄 데이터(TIFF/PNG/JPG) 자동 생성.
compose_fabric.py 를 subprocess 로 실행, 로그를 실시간 표시.

실행:
    python gui.py
    or
    pythonw gui.py  (콘솔 창 없이 GUI 만)
"""
import json
import os
import sys
import threading
import subprocess
import urllib.request
import urllib.error
from pathlib import Path
from queue import Queue, Empty

import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox, filedialog


__version__ = '2026.06.10.4'   # 패턴 파일명(롤인쇄N개_W폭_고객_원단) + 4모서리 돔보마크 5mm

SCRIPT_NAME = 'compose_fabric.py'
GUI_NAME    = 'gui.py'
CONFIG_NAME = 'config.json'

# Cloudflare Pages — public, always-on, CDN cached (GitHub raw 보다 안정)
BASE_URL    = 'https://www.cafe2626.com/tools/cotton_print_compose'
SCRIPT_URL  = f'{BASE_URL}/{SCRIPT_NAME}'
GUI_URL     = f'{BASE_URL}/{GUI_NAME}'

# 색상 팔레트 (cotton-print 브라운/크림 톤)
C_BG       = '#faf6ed'
C_BROWN_D  = '#451a03'
C_BROWN    = '#78350f'
C_ACCENT   = '#b45309'
C_GOLD     = '#fde047'
C_CREAM_D  = '#f3ead4'
C_TEXT     = '#1f2937'
C_MUTED    = '#94a3b8'
C_SUCCESS  = '#16a34a'
C_WARN     = '#f59e0b'
C_DANGER   = '#dc2626'
C_LOG_BG   = '#1e293b'
C_LOG_FG   = '#bef264'


class CottonPrintGUI:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title('Cotton Print — 인쇄 데이터 생성기')
        self.root.geometry('760x720')
        self.root.minsize(680, 600)
        self.root.configure(bg=C_BG)

        # 경로
        self.work_dir    = Path(__file__).parent.resolve()
        self.script_path = self.work_dir / SCRIPT_NAME
        self.config_path = self.work_dir / CONFIG_NAME

        # 설정 로드 (output_dir 등)
        self.config = self._load_config()
        # output_dir — 설정 우선, 없으면 기본값 (work_dir/output)
        cfg_out = self.config.get('output_dir')
        self.output_dir = Path(cfg_out) if cfg_out else (self.work_dir / 'output')

        self.process = None
        self.is_running = False

        self._build_ui()
        # 잠시 후 셋업 체크 (UI 먼저 보여주기)
        self.root.after(200, self._check_setup)

    # ─── 설정 로드/저장 ─────────────────────────────────────
    def _load_config(self):
        try:
            if self.config_path.exists():
                return json.loads(self.config_path.read_text(encoding='utf-8'))
        except Exception:
            pass
        return {}

    def _save_config(self):
        try:
            self.config_path.write_text(
                json.dumps(self.config, ensure_ascii=False, indent=2),
                encoding='utf-8'
            )
        except Exception as e:
            self._log(f'[!] 설정 저장 실패: {e}')

    # ─── UI 구성 ──────────────────────────────────────────────
    def _build_ui(self):
        # 헤더 ─────────────────────────────
        header = tk.Frame(self.root, bg=C_BROWN_D, height=70)
        header.pack(fill='x')
        header.pack_propagate(False)

        title_frame = tk.Frame(header, bg=C_BROWN_D)
        title_frame.pack(side='left', padx=20)
        tk.Label(title_frame, text='Cotton Print',
                 font=('Segoe UI', 20, 'bold'),
                 bg=C_BROWN_D, fg=C_GOLD).pack(anchor='w')
        tk.Label(title_frame, text='패브릭 인쇄 데이터 생성기 · Chameleon Printing',
                 font=('Segoe UI', 10),
                 bg=C_BROWN_D, fg='#fef3c7').pack(anchor='w')

        # 메인 컨테이너 ─────────────────────────────
        main = tk.Frame(self.root, bg=C_BG, padx=24, pady=18)
        main.pack(fill='both', expand=True)

        # ─── 입력 그룹 ───
        input_frame = tk.LabelFrame(main, text='  주문 정보  ',
                                     font=('Segoe UI', 10, 'bold'),
                                     bg=C_BG, fg=C_BROWN_D,
                                     padx=14, pady=12,
                                     bd=2, relief='groove')
        input_frame.pack(fill='x', pady=(0, 12))

        # 주문번호
        r = tk.Frame(input_frame, bg=C_BG)
        r.pack(fill='x', pady=4)
        tk.Label(r, text='주문번호:', font=('Segoe UI', 11, 'bold'),
                 bg=C_BG, fg=C_BROWN_D, width=12, anchor='e').pack(side='left')
        self.order_entry = tk.Entry(r, font=('Consolas', 14), width=16,
                                     bd=2, relief='solid', highlightthickness=0)
        self.order_entry.pack(side='left', padx=(10, 8))
        tk.Label(r, text='작업지시서 URL의 ?id= 뒤 숫자 (예: 3553)',
                 font=('Segoe UI', 9),
                 bg=C_BG, fg=C_MUTED).pack(side='left')

        # 출력 포맷
        r = tk.Frame(input_frame, bg=C_BG)
        r.pack(fill='x', pady=(10, 4))
        tk.Label(r, text='출력 포맷:', font=('Segoe UI', 11, 'bold'),
                 bg=C_BG, fg=C_BROWN_D, width=12, anchor='e').pack(side='left')
        self.format_var = tk.StringVar(value='tiff')
        for val, lbl in [
            ('tiff', '🖨️ TIFF (인쇄소 표준)'),
            ('jpg',  '🗜️ JPG (용량 작음)'),
            ('png',  '🪞 PNG (투명 배경)')
        ]:
            tk.Radiobutton(r, text=lbl, variable=self.format_var, value=val,
                           font=('Segoe UI', 10),
                           bg=C_BG, fg=C_TEXT,
                           selectcolor=C_CREAM_D,
                           activebackground=C_BG,
                           cursor='hand2').pack(side='left', padx=(10, 0))

        # 항목 선택
        r = tk.Frame(input_frame, bg=C_BG)
        r.pack(fill='x', pady=(10, 4))
        tk.Label(r, text='항목 선택:', font=('Segoe UI', 11, 'bold'),
                 bg=C_BG, fg=C_BROWN_D, width=12, anchor='e').pack(side='left')
        self.all_items_var = tk.BooleanVar(value=True)
        tk.Checkbutton(r, text='모든 항목 처리', variable=self.all_items_var,
                       font=('Segoe UI', 10),
                       bg=C_BG, fg=C_TEXT,
                       selectcolor=C_CREAM_D,
                       activebackground=C_BG,
                       cursor='hand2',
                       command=self._toggle_item_idx).pack(side='left', padx=(10, 10))
        tk.Label(r, text='또는 특정 항목만:', font=('Segoe UI', 10),
                 bg=C_BG, fg=C_TEXT).pack(side='left')
        self.item_entry = tk.Entry(r, font=('Consolas', 11), width=5,
                                    state='disabled', bd=2, relief='solid')
        self.item_entry.pack(side='left', padx=6)
        tk.Label(r, text='(0=첫번째, 1=두번째...)', font=('Segoe UI', 9),
                 bg=C_BG, fg=C_MUTED).pack(side='left')

        # DPI
        r = tk.Frame(input_frame, bg=C_BG)
        r.pack(fill='x', pady=(10, 4))
        tk.Label(r, text='해상도:', font=('Segoe UI', 11, 'bold'),
                 bg=C_BG, fg=C_BROWN_D, width=12, anchor='e').pack(side='left')
        self.dpi_var = tk.StringVar(value='150')
        ttk.Combobox(r, textvariable=self.dpi_var,
                     values=['100', '150', '200', '300'],
                     width=8, font=('Consolas', 11),
                     state='readonly').pack(side='left', padx=(10, 8))
        tk.Label(r, text='dpi · 150=표준(권장), 300=고화질 (파일 4배 커짐)',
                 font=('Segoe UI', 9),
                 bg=C_BG, fg=C_MUTED).pack(side='left')

        # ─── 저장 폴더 ───
        r = tk.Frame(input_frame, bg=C_BG)
        r.pack(fill='x', pady=(10, 4))
        tk.Label(r, text='저장 폴더:', font=('Segoe UI', 11, 'bold'),
                 bg=C_BG, fg=C_BROWN_D, width=12, anchor='e').pack(side='left')
        self.output_var = tk.StringVar(value=str(self.output_dir))
        out_entry = tk.Entry(r, textvariable=self.output_var,
                             font=('Consolas', 9),
                             state='readonly',
                             readonlybackground='#fff',
                             bd=2, relief='solid')
        out_entry.pack(side='left', padx=(10, 6), fill='x', expand=True)
        tk.Button(r, text='📁 선택', font=('Segoe UI', 9),
                  bg=C_CREAM_D, fg=C_BROWN_D, bd=0,
                  activebackground='#e7d8a8',
                  cursor='hand2', padx=10, pady=4,
                  command=self._browse_output).pack(side='left', padx=(0, 4))
        tk.Button(r, text='↩ 기본', font=('Segoe UI', 9),
                  bg=C_CREAM_D, fg=C_BROWN_D, bd=0,
                  activebackground='#e7d8a8',
                  cursor='hand2', padx=10, pady=4,
                  command=self._reset_output).pack(side='left')

        # ─── 생성 버튼 ───
        self.gen_btn = tk.Button(main, text='🎨   인쇄 데이터 생성   ',
                                 font=('Segoe UI', 14, 'bold'),
                                 bg=C_ACCENT, fg='#fff',
                                 activebackground=C_BROWN,
                                 activeforeground=C_GOLD,
                                 relief='flat', bd=0,
                                 padx=20, pady=14,
                                 cursor='hand2',
                                 command=self._on_generate)
        self.gen_btn.pack(fill='x', pady=(4, 10))

        # 진행 바
        self.progress = ttk.Progressbar(main, mode='indeterminate', length=300)
        self.progress.pack(fill='x', pady=(0, 10))

        # ─── 로그 ───
        log_label = tk.Frame(main, bg=C_BG)
        log_label.pack(fill='x', pady=(4, 4))
        tk.Label(log_label, text='실행 로그',
                 font=('Segoe UI', 10, 'bold'),
                 bg=C_BG, fg=C_BROWN_D).pack(side='left')
        tk.Button(log_label, text='로그 지우기', font=('Segoe UI', 8),
                  bg=C_CREAM_D, fg=C_BROWN_D, relief='flat',
                  cursor='hand2',
                  command=lambda: self.log_text.delete('1.0', 'end')
                  ).pack(side='right')

        self.log_text = scrolledtext.ScrolledText(main, height=12,
                                                   font=('Consolas', 9),
                                                   bg=C_LOG_BG, fg=C_LOG_FG,
                                                   insertbackground='#fff',
                                                   bd=0, relief='flat',
                                                   padx=10, pady=8)
        self.log_text.pack(fill='both', expand=True)

        # ─── 하단 버튼 ───
        bottom = tk.Frame(main, bg=C_BG)
        bottom.pack(fill='x', pady=(10, 0))

        tk.Button(bottom, text='📁  output 폴더 열기',
                  font=('Segoe UI', 10), bd=0,
                  bg=C_CREAM_D, fg=C_BROWN_D,
                  activebackground='#e7d8a8',
                  cursor='hand2', padx=14, pady=7,
                  command=self._open_output).pack(side='left', padx=(0, 8))

        tk.Button(bottom, text='❓  도움말',
                  font=('Segoe UI', 10), bd=0,
                  bg=C_CREAM_D, fg=C_BROWN_D,
                  activebackground='#e7d8a8',
                  cursor='hand2', padx=14, pady=7,
                  command=self._show_help).pack(side='left')

        tk.Button(bottom, text='🔄  업데이트',
                  font=('Segoe UI', 10), bd=0,
                  bg=C_CREAM_D, fg=C_BROWN_D,
                  activebackground='#e7d8a8',
                  cursor='hand2', padx=14, pady=7,
                  command=self._check_update).pack(side='left', padx=(8, 0))

        # Windows 만 — 바탕화면 바로가기 생성 버튼
        if os.name == 'nt':
            tk.Button(bottom, text='🖥️  바로가기',
                      font=('Segoe UI', 10), bd=0,
                      bg=C_CREAM_D, fg=C_BROWN_D,
                      activebackground='#e7d8a8',
                      cursor='hand2', padx=14, pady=7,
                      command=self._create_desktop_shortcut).pack(side='left', padx=(8, 0))

        self.status_lbl = tk.Label(bottom, text='⚪ 준비 중...',
                                    font=('Segoe UI', 10, 'bold'),
                                    bg=C_BG, fg=C_MUTED)
        self.status_lbl.pack(side='right')

        # 버전 표시 (작게)
        ver_lbl = tk.Label(bottom, text=f'v{__version__}',
                           font=('Consolas', 8),
                           bg=C_BG, fg=C_MUTED)
        ver_lbl.pack(side='right', padx=(0, 8))

        # Enter 키로 생성
        self.order_entry.bind('<Return>', lambda e: self._on_generate())
        self.order_entry.focus_set()

    # ─── 헬퍼 ──────────────────────────────────────────────
    def _toggle_item_idx(self):
        if self.all_items_var.get():
            self.item_entry.config(state='disabled')
            self.item_entry.delete(0, 'end')
        else:
            self.item_entry.config(state='normal')
            self.item_entry.focus_set()

    def _log(self, msg):
        if not msg:
            return
        self.log_text.insert('end', msg + '\n')
        self.log_text.see('end')

    def _set_status(self, txt, color):
        self.status_lbl.config(text=txt, fg=color)

    # ─── 저장 폴더 ────────────────────────────────────────
    def _browse_output(self):
        chosen = filedialog.askdirectory(
            title='인쇄 데이터 저장 폴더 선택',
            initialdir=str(self.output_dir) if self.output_dir.exists()
                       else str(self.work_dir)
        )
        if chosen:
            self.output_dir = Path(chosen)
            self.output_var.set(str(self.output_dir))
            self.config['output_dir'] = str(self.output_dir)
            self._save_config()
            self._log(f'[OK] 저장 폴더 변경: {self.output_dir}')

    def _reset_output(self):
        default = self.work_dir / 'output'
        self.output_dir = default
        self.output_var.set(str(default))
        self.config.pop('output_dir', None)
        self._save_config()
        self._log(f'[OK] 저장 폴더 기본값으로 복원: {default}')

    # ─── 바탕화면 바로가기 ───────────────────────────────
    def _create_desktop_shortcut(self):
        if os.name != 'nt':
            messagebox.showinfo('알림', '바로가기 생성은 Windows 전용입니다.')
            return
        try:
            desktop = Path(os.path.expanduser('~/Desktop'))
            if not desktop.exists():
                # OneDrive 백업 등으로 경로가 다를 수 있음 — USERPROFILE 폴백
                desktop = Path(os.environ.get('USERPROFILE', '')) / 'Desktop'
            shortcut_path = desktop / 'Cotton Print.lnk'
            # 런처 BAT 우선, 없으면 직접 gui.py 실행
            bat_path = self.work_dir / 'Cotton_Print.bat'
            if bat_path.exists():
                target = str(bat_path)
                workdir = str(self.work_dir)
            else:
                # pythonw 로 gui.py 직접 실행
                target = sys.executable.replace('python.exe', 'pythonw.exe')
                if not Path(target).exists():
                    target = sys.executable
                workdir = str(self.work_dir)

            # PowerShell COM 으로 .lnk 생성
            ps_cmd = (
                f'$s = (New-Object -ComObject WScript.Shell)'
                f'.CreateShortcut("{shortcut_path}"); '
                f'$s.TargetPath = "{target}"; '
                f'$s.WorkingDirectory = "{workdir}"; '
                f'$s.IconLocation = "%SystemRoot%\\System32\\imageres.dll,68"; '
                f'$s.Description = "Cotton Print Fabric Composer"; '
            )
            # gui.py 직접 실행 모드면 인자 추가
            if not bat_path.exists():
                ps_cmd += f'$s.Arguments = """{self.work_dir / GUI_NAME}"""; '
            ps_cmd += '$s.Save()'

            r = subprocess.run(
                ['powershell', '-NoProfile', '-Command', ps_cmd],
                capture_output=True, text=True, timeout=15,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            if r.returncode == 0 and shortcut_path.exists():
                self._log(f'[OK] 바탕화면 바로가기 생성: {shortcut_path.name}')
                messagebox.showinfo('바로가기 생성 완료',
                                    f'바탕화면에 "Cotton Print" 바로가기가 만들어졌습니다.\n\n'
                                    f'위치: {shortcut_path}')
            else:
                err = r.stderr or '알 수 없는 오류'
                self._log(f'[X] 바로가기 생성 실패: {err[:200]}')
                messagebox.showerror('바로가기 생성 실패',
                                     f'바로가기를 만들지 못했습니다.\n\n{err[:300]}')
        except Exception as e:
            self._log(f'[X] 바로가기 생성 오류: {e}')
            messagebox.showerror('오류', str(e))

    # ─── 셋업 체크 (Pillow / 스크립트) ─────────────────────
    def _check_setup(self):
        self._log('[시작] Cotton Print GUI 초기화')

        # Pillow 체크
        try:
            import PIL  # noqa: F401
            self._log(f'[OK] Pillow {PIL.__version__} 준비됨')
            self._after_pillow()
        except ImportError:
            self._log('[..] Pillow 라이브러리 자동 설치 중... (잠시만요)')
            self._set_status('🟡 Pillow 설치 중...', C_WARN)
            threading.Thread(target=self._install_pillow, daemon=True).start()

    def _install_pillow(self):
        try:
            result = subprocess.run(
                [sys.executable, '-m', 'pip', 'install', '--quiet', 'Pillow'],
                capture_output=True, text=True, timeout=180
            )
            if result.returncode == 0:
                self.root.after(0, self._log, '[OK] Pillow 설치 완료')
                self.root.after(0, self._after_pillow)
            else:
                self.root.after(0, self._log, f'[X] Pillow 설치 실패\n{result.stderr[:300]}')
                self.root.after(0, self._set_status, '🔴 Pillow 설치 실패', C_DANGER)
        except Exception as e:
            self.root.after(0, self._log, f'[X] Pillow 설치 오류: {e}')
            self.root.after(0, self._set_status, '🔴 설치 실패', C_DANGER)

    def _after_pillow(self):
        if not self.script_path.exists():
            self._log('[..] compose_fabric.py 다운로드 중...')
            threading.Thread(target=self._download_script, daemon=True).start()
        else:
            self._log(f'[OK] compose_fabric.py 준비됨')
            self._ready()

    def _download_script(self):
        try:
            urllib.request.urlretrieve(SCRIPT_URL, str(self.script_path))
            self.root.after(0, self._log, '[OK] compose_fabric.py 다운로드 완료')
            self.root.after(0, self._ready)
        except urllib.error.HTTPError as e:
            self.root.after(0, self._log,
                            f'[X] 다운로드 실패 (HTTP {e.code})')
            self.root.after(0, self._log,
                            '    저장소가 비공개일 수 있습니다. compose_fabric.py 를')
            self.root.after(0, self._log,
                            '    이 폴더에 직접 넣어주세요.')
            self.root.after(0, self._set_status, '🔴 스크립트 누락', C_DANGER)
        except Exception as e:
            self.root.after(0, self._log, f'[X] 다운로드 오류: {e}')
            self.root.after(0, self._set_status, '🔴 다운로드 실패', C_DANGER)

    def _ready(self):
        self._set_status('🟢 준비됨', C_SUCCESS)
        self._log('')
        self._log('주문번호 입력 후 [인쇄 데이터 생성] 버튼을 누르세요.')

    # ─── 생성 ──────────────────────────────────────────────
    def _on_generate(self):
        if self.is_running:
            messagebox.showwarning('실행 중',
                                   '이미 처리 중입니다. 끝날 때까지 기다려주세요.')
            return

        order_id = self.order_entry.get().strip()
        if not order_id:
            messagebox.showerror('입력 오류', '주문번호를 입력해주세요.')
            self.order_entry.focus_set()
            return
        if not order_id.isdigit():
            messagebox.showerror('입력 오류',
                                 '주문번호는 숫자만 가능합니다.\n'
                                 f'입력값: {order_id}')
            self.order_entry.focus_set()
            return

        if not self.script_path.exists():
            messagebox.showerror('스크립트 누락',
                                 'compose_fabric.py 가 없습니다.\n'
                                 f'다음 폴더에 직접 넣어주세요:\n{self.work_dir}')
            return

        # 항목 인덱스 검증
        item_idx = None
        if not self.all_items_var.get():
            idx_str = self.item_entry.get().strip()
            if idx_str:
                if not idx_str.isdigit():
                    messagebox.showerror('입력 오류',
                                         '항목 번호는 숫자만 가능합니다.')
                    return
                item_idx = idx_str

        # 명령 구성
        cmd = [sys.executable, str(self.script_path),
               '--order-id', order_id,
               '--format', self.format_var.get(),
               '--dpi', self.dpi_var.get(),
               '--output-dir', str(self.output_dir)]
        if item_idx is not None:
            cmd += ['--item-idx', item_idx]

        self.is_running = True
        self.gen_btn.config(state='disabled', text='🔄   처리 중...   ')
        self.progress.start(10)
        self._set_status(f'🟡 주문 #{order_id} 처리 중...', C_WARN)

        self._log('')
        self._log('=' * 60)
        self._log(f'  주문 #{order_id} 합성 시작 — {self.format_var.get().upper()} @ {self.dpi_var.get()}dpi')
        self._log('=' * 60)

        threading.Thread(target=self._run_process,
                         args=(cmd, order_id), daemon=True).start()

    def _run_process(self, cmd, order_id):
        try:
            # 2026-06-10: 자식 Python 도 stdout/stderr 을 UTF-8 로 강제 (CP949 우회)
            child_env = dict(os.environ)
            child_env['PYTHONIOENCODING'] = 'utf-8'
            child_env['PYTHONUTF8'] = '1'
            kwargs = {
                'stdout': subprocess.PIPE,
                'stderr': subprocess.STDOUT,
                'text': True,
                'bufsize': 1,
                'encoding': 'utf-8',
                'errors': 'replace',
                'cwd': str(self.work_dir),
                'env': child_env,
            }
            if os.name == 'nt':
                kwargs['creationflags'] = subprocess.CREATE_NO_WINDOW

            self.process = subprocess.Popen(cmd, **kwargs)
            for line in self.process.stdout:
                self.root.after(0, self._log, line.rstrip())
            rc = self.process.wait()
            self.process = None

            if rc == 0:
                self.root.after(0, self._on_success, order_id)
            else:
                self.root.after(0, self._on_failure,
                                f'프로세스 종료 코드 {rc}')
        except Exception as e:
            self.root.after(0, self._on_failure, str(e))

    def _on_success(self, order_id):
        self.is_running = False
        self.progress.stop()
        self.gen_btn.config(state='normal', text='🎨   인쇄 데이터 생성   ')
        self._set_status(f'🟢 완료! 주문 #{order_id}', C_SUCCESS)
        self._log('')
        self._log('✅ 완료! output 폴더를 엽니다.')
        self._open_output()
        self.order_entry.delete(0, 'end')
        self.order_entry.focus_set()

    def _on_failure(self, msg):
        self.is_running = False
        self.progress.stop()
        self.gen_btn.config(state='normal', text='🎨   인쇄 데이터 생성   ')
        self._set_status('🔴 실패', C_DANGER)
        self._log('')
        self._log(f'❌ 실패: {msg}')
        messagebox.showerror('실행 실패',
                             f'합성에 실패했습니다.\n\n{msg}\n\n'
                             '아래 로그를 본사에 전달해주세요.')

    def _open_output(self):
        self.output_dir.mkdir(exist_ok=True)
        try:
            if os.name == 'nt':
                os.startfile(str(self.output_dir))
            elif sys.platform == 'darwin':
                subprocess.run(['open', str(self.output_dir)])
            else:
                subprocess.run(['xdg-open', str(self.output_dir)])
        except Exception as e:
            messagebox.showinfo('출력 폴더',
                                f'output 폴더 위치:\n{self.output_dir}\n\n({e})')

    # ─── 업데이트 ────────────────────────────────────────
    def _check_update(self):
        """수동 업데이트 확인 — 강제 재다운로드 + 버전 비교."""
        if self.is_running:
            messagebox.showwarning('실행 중',
                                   '합성 작업 중에는 업데이트할 수 없습니다.\n'
                                   '완료 후 다시 시도하세요.')
            return

        self._log('')
        self._log('[..] 최신 버전 확인 중...')
        self._set_status('🟡 업데이트 확인 중...', C_WARN)
        threading.Thread(target=self._do_update, daemon=True).start()

    def _do_update(self):
        import re
        import time
        updated = []
        failed = []
        # gui.py + compose_fabric.py 둘 다 시도
        targets = [(GUI_NAME, GUI_URL), (SCRIPT_NAME, SCRIPT_URL)]
        for fname, url in targets:
            local_path = self.work_dir / fname
            try:
                # 캐시 우회
                fetch_url = f'{url}?t={int(time.time())}'
                req = urllib.request.Request(fetch_url,
                                              headers={'User-Agent': f'cotton-print-gui/{__version__}'})
                with urllib.request.urlopen(req, timeout=20) as resp:
                    new_bytes = resp.read()
                if len(new_bytes) < 1000:
                    failed.append(f'{fname}: 너무 작음')
                    continue

                # 기존 파일과 비교
                old_bytes = b''
                if local_path.exists():
                    old_bytes = local_path.read_bytes()

                if new_bytes == old_bytes:
                    self.root.after(0, self._log, f'    [=] {fname}: 이미 최신')
                else:
                    # 새 버전 추출 시도 (gui.py 의 __version__)
                    if fname == GUI_NAME:
                        m = re.search(rb"__version__\s*=\s*['\"]([\d\.]+)['\"]",
                                       new_bytes)
                        new_ver = m.group(1).decode('ascii') if m else '?'
                    else:
                        new_ver = ''
                    local_path.write_bytes(new_bytes)
                    label = f'{fname} → v{new_ver}' if new_ver else fname
                    updated.append(label)
                    self.root.after(0, self._log, f'    [✓] {label} 업데이트됨')
            except Exception as e:
                failed.append(f'{fname}: {e}')
                self.root.after(0, self._log, f'    [X] {fname}: {e}')

        # 결과 안내
        if updated:
            self.root.after(0, self._update_done_dialog, updated)
        elif failed:
            self.root.after(0, self._set_status, '🔴 업데이트 실패', C_DANGER)
            self.root.after(0, messagebox.showerror, '업데이트 실패',
                            '업데이트 중 문제가 발생했습니다.\n\n' +
                            '\n'.join(failed))
        else:
            self.root.after(0, self._set_status, '🟢 최신 버전 사용 중', C_SUCCESS)
            self.root.after(0, messagebox.showinfo, '최신 버전',
                            f'이미 최신 버전(v{__version__})을 사용 중입니다.')

    def _update_done_dialog(self, updated):
        """업데이트 완료 시 자동 재시작 (확인 다이얼로그만 한 번 표시)."""
        self._set_status('🟢 업데이트 완료 — 재시작 중...', C_SUCCESS)
        msg = ('다음 파일이 업데이트되었습니다:\n\n'
               + '\n'.join(f'  • {x}' for x in updated)
               + '\n\n새 버전으로 자동 재시작합니다.')
        messagebox.showinfo('업데이트 완료', msg)
        self._restart_app()

    def _restart_app(self):
        """현재 GUI 종료 후 새 인스턴스 실행."""
        try:
            gui_file = self.work_dir / GUI_NAME
            # Windows: pythonw 우선 (콘솔 안 보임)
            if os.name == 'nt':
                pythonw = sys.executable.replace('python.exe', 'pythonw.exe')
                exe = pythonw if Path(pythonw).exists() else sys.executable
                # DETACHED_PROCESS: 부모와 분리 — 현재 GUI 종료해도 새 GUI 살아있음
                DETACHED_PROCESS = 0x00000008
                subprocess.Popen(
                    [exe, str(gui_file)],
                    cwd=str(self.work_dir),
                    creationflags=DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
                    close_fds=True,
                )
            else:
                # Mac/Linux
                subprocess.Popen(
                    [sys.executable, str(gui_file)],
                    cwd=str(self.work_dir),
                    start_new_session=True,
                )
        except Exception as e:
            messagebox.showerror('재시작 실패',
                                 f'자동 재시작 실패. 수동으로 BAT 를 다시 실행해주세요.\n\n{e}')
        finally:
            self.root.destroy()

    def _show_help(self):
        help_text = (
            "🖨️  Cotton Print 인쇄 데이터 생성기\n"
            "=" * 50 + "\n\n"
            "【 사용법 】\n"
            "1. 주문번호 입력 (작업지시서 URL ?id= 뒤 숫자)\n"
            "2. 출력 포맷 선택 (기본 TIFF — 인쇄소 표준)\n"
            "3. [인쇄 데이터 생성] 클릭\n"
            "4. output 폴더가 자동으로 열림\n\n"
            "【 옵션 설명 】\n"
            "• 모든 항목 처리: 주문 안 모든 패브릭 일괄 처리\n"
            "• 특정 항목만: 0=첫번째, 1=두번째...\n"
            "• DPI 150: 패브릭 인쇄 표준 (권장)\n"
            "• DPI 300: 고해상도, 파일 4배 커짐\n\n"
            "【 트러블슈팅 】\n"
            "• \"artwork_url 없음\" 에러\n"
            "  → 작업지시서에 디자인 파일이 안 올라간 상태.\n"
            "    매니저 페이지에서 [파일 첨부] 후 재시도.\n\n"
            "• 너무 오래 걸림 (1-2분 이상)\n"
            "  → 큰 출력 사이즈(130×500cm+)는 정상.\n"
            "    아주 오래 걸리면 DPI 를 100으로 낮춰서 재시도.\n\n"
            "• 메모리 부족\n"
            "  → DPI 100 + JPG 포맷으로 재시도.\n\n"
            "【 문의 】\n"
            "본사 카멜레온프린팅\n"
            "Tel: 031-366-1984\n"
            "Mail: design@chameleon.design"
        )
        messagebox.showinfo('도움말 — Cotton Print 생성기', help_text)


def main():
    root = tk.Tk()
    # Windows 에서 DPI 인지
    try:
        from ctypes import windll
        windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        pass

    app = CottonPrintGUI(root)

    def on_close():
        if app.is_running and app.process:
            if messagebox.askyesno('종료 확인',
                                    '작업 중입니다. 정말 종료하시겠습니까?'):
                try:
                    app.process.terminate()
                except Exception:
                    pass
                root.destroy()
        else:
            root.destroy()

    root.protocol('WM_DELETE_WINDOW', on_close)
    root.mainloop()


if __name__ == '__main__':
    main()
