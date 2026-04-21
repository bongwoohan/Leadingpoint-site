/**
 * components.js
 * 공통 헤더/푸터를 로드하고, 페이지별 설정을 적용합니다.
 *
 * 각 페이지의 <body>에 data 속성으로 설정을 전달합니다:
 *   data-page      : 현재 페이지 키 (home | disaster-recovery | cloud | biometrics | partners | clients | company)
 *   data-logo      : 사용할 로고 이미지 경로
 *
 * 예시:
 *   <body data-page="disaster-recovery" data-logo="images/logo/LP-LOGO-transparent.png">
 */

(function () {

  /* ── 페이지별 설정 맵 ── */
  const PAGE_CONFIG = {
    'home': {
      navActiveId:      'nav-home-link',   // nav에서 active 처리할 링크 id
      ovActiveId:       'ov-home-link',    // 오버레이에서 active 처리할 id
      ovBusinessOpen:   false,             // 오버레이에서 Business 서브메뉴 기본 열림 여부
      ovBusinessActive: false,             // 오버레이 Business 라벨 active 여부
      footActiveId:     null,              // 푸터 active 링크 id
      bttTheme:         'light',           // Back-to-Top 버튼 테마 (light | dark)
    },
    'disaster-recovery': {
      navActiveId:      'nav-dr',
      ovActiveId:       'ov-dr',
      ovBusinessOpen:   true,
      ovBusinessActive: true,
      footActiveId:     'foot-dr',
      bttTheme:         'dark',
    },
    'active-active-nas-dr': {
      navActiveId:      'nav-nas-dr',
      ovActiveId:       'ov-nas-dr',
      ovBusinessOpen:   true,
      ovBusinessActive: true,
      footActiveId:     'foot-nas-dr',
      bttTheme:         'dark',
    },
    'cloud': {
      navActiveId:      'nav-cloud',
      ovActiveId:       'ov-cloud',
      ovBusinessOpen:   true,
      ovBusinessActive: true,
      footActiveId:     'foot-cloud',
      bttTheme:         'dark',
    },
    'technology': {
      navActiveId:      'nav-tech',
      ovActiveId:       'ov-tech',
      ovBusinessOpen:   true,
      ovBusinessActive: true,
      footActiveId:     'foot-tech',
      bttTheme:         'dark',
    },
    'biometrics': {
      navActiveId:      'nav-bio',
      ovActiveId:       'ov-bio',
      ovBusinessOpen:   true,
      ovBusinessActive: true,
      footActiveId:     'foot-bio',
      bttTheme:         'dark',
    },
    'partners': {
      navActiveId:      'nav-partners',
      ovActiveId:       'ov-partners',
      ovBusinessOpen:   false,
      ovBusinessActive: false,
      footActiveId:     'foot-partners',
      bttTheme:         'light',
    },
    'clients': {
      navActiveId:      'nav-clients',
      ovActiveId:       'ov-clients',
      ovBusinessOpen:   false,
      ovBusinessActive: false,
      footActiveId:     'foot-clients',
      bttTheme:         'light',
    },
    'company': {
      navActiveId:      'nav-contact',
      ovActiveId:       'ov-contact',
      ovBusinessOpen:   false,
      ovBusinessActive: false,
      footActiveId:     'foot-contact',
      bttTheme:         'light',
    },
  };

  /* ── HTML 파일 fetch 헬퍼 ── */
  async function fetchHTML(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error('Failed to load: ' + path);
    return res.text();
  }

  /* ── 헤더 후처리: 로고 + active 상태 적용 ── */
  function applyHeaderConfig(pageKey, logoSrc) {
    const cfg = PAGE_CONFIG[pageKey] || {};

    /* 로고 이미지 */
    if (logoSrc) {
      const navLogo     = document.getElementById('nav-logo-img');
      const overlayLogo = document.getElementById('overlay-logo-img');
      if (navLogo)     navLogo.src     = logoSrc;
      if (overlayLogo) overlayLogo.src = logoSrc;
    }

    /* 데스크톱 nav active */
    if (cfg.navActiveId) {
      const el = document.getElementById(cfg.navActiveId);
      if (el) el.classList.add('active');
    }

    /* 오버레이 mobile active */
    if (cfg.ovActiveId) {
      const el = document.getElementById(cfg.ovActiveId);
      if (el) el.classList.add('active');
    }

    /* 오버레이 Business 라벨 active */
    if (cfg.ovBusinessActive) {
      const label = document.getElementById('ov-business-label');
      if (label) label.classList.add('active');
    }

    /* 오버레이 Business 서브메뉴 기본 열림 */
    if (cfg.ovBusinessOpen) {
      const top = document.getElementById('ov-business-top');
      const sub = document.getElementById('ov-business');
      if (top) top.classList.add('open');
      if (sub) sub.classList.add('open');
    }
  }

  /* ── 푸터 후처리: active 상태 + 연도 ── */
  function applyFooterConfig(pageKey) {
    const cfg = PAGE_CONFIG[pageKey] || {};

    /* 현재 페이지 링크 active */
    if (cfg.footActiveId) {
      const el = document.getElementById(cfg.footActiveId);
      if (el) el.classList.add('active');
    }

    /* 연도 자동 */
    const copy = document.getElementById('footer-copy');
    if (copy) {
      copy.textContent = '© ' + new Date().getFullYear() + ' Leading Point. All rights reserved.';
    }
  }

  /* ── Back to Top 버튼 ── */
  function initBackToTop(pageKey) {
    const scrollContainer = document.getElementById('scroll-container');
    if (!scrollContainer) return;

    const cfg   = PAGE_CONFIG[pageKey] || {};
    const theme = cfg.bttTheme || 'dark'; /* 'light' | 'dark' */

    /* 스타일 주입 (한 번만) */
    if (!document.getElementById('btt-style')) {
      const style = document.createElement('style');
      style.id = 'btt-style';
      style.textContent = `
        #back-to-top {
          position: fixed;
          bottom: 2.2rem;
          right: 2.2rem;
          z-index: 900;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transform: translateY(14px) scale(0.88);
          pointer-events: none;
          transition:
            opacity   0.4s cubic-bezier(0.16,1,0.3,1),
            transform 0.4s cubic-bezier(0.16,1,0.3,1),
            box-shadow 0.25s ease,
            color 0.25s ease;
        }

        /* 다크 테마 — disaster-recovery, cloud, biometrics 등 어두운 배경 페이지 */
        #back-to-top.btt-dark {
          background: #1f2b3d;
          box-shadow:
            -3px -3px 8px  rgba(255,255,255,0.06),
             3px  3px 8px  rgba(0,0,0,0.55),
             0 0 0 1px rgba(255,255,255,0.05);
          color: rgba(200,216,240,0.65);
        }
        #back-to-top.btt-dark:hover {
          color: #f0956e;
          box-shadow:
            -3px -3px 8px  rgba(255,255,255,0.06),
             3px  3px 8px  rgba(0,0,0,0.55),
             0 0 0 1px rgba(240,149,110,0.35),
             0 0 0 6px rgba(240,149,110,0.10);
        }

        /* 라이트 테마 — home, partners, clients, company 밝은 배경 페이지 */
        #back-to-top.btt-light {
          background: #ebebeb;
          box-shadow:
            -4px -4px 10px rgba(255,255,255,0.90),
             4px  4px 10px rgba(0,0,0,0.12),
             0 0 0 1px rgba(0,0,0,0.04);
          color: rgba(26,26,26,0.45);
        }
        #back-to-top.btt-light:hover {
          color: #f0956e;
          box-shadow:
            -4px -4px 10px rgba(255,255,255,0.90),
             4px  4px 10px rgba(0,0,0,0.12),
             0 0 0 1px rgba(240,149,110,0.40),
             0 0 0 6px rgba(240,149,110,0.12);
        }

        /* 표시 상태 */
        #back-to-top.btt-visible {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: all;
        }

        /* 아이콘 */
        #back-to-top svg {
          width: 18px;
          height: 18px;
          transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
          flex-shrink: 0;
        }
        #back-to-top:hover svg {
          transform: translateY(-2px);
        }

        /* 모바일: 살짝 작게, 위치 조정 */
        @media (max-width: 640px) {
          #back-to-top {
            width: 42px;
            height: 42px;
            bottom: 1.5rem;
            right: 1.5rem;
          }
          #back-to-top svg {
            width: 16px;
            height: 16px;
          }
        }
      `;
      document.head.appendChild(style);
    }

    /* 버튼 DOM 생성 */
    const btn = document.createElement('button');
    btn.id = 'back-to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.classList.add('btt-' + theme);
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="18 15 12 9 6 15"/>
      </svg>
    `;
    document.body.appendChild(btn);

    /* 스크롤 감지 — 200px 이상 내려가면 버튼 표시 */
    scrollContainer.addEventListener('scroll', () => {
      if (scrollContainer.scrollTop > 200) {
        btn.classList.add('btt-visible');
      } else {
        btn.classList.remove('btt-visible');
      }
    }, { passive: true });

    /* 클릭 → 최상단으로 부드럽게 이동 */
    btn.addEventListener('click', () => {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ── 메인 로드 함수 ── */
  async function loadComponents() {
    const body    = document.body;
    const pageKey = body.dataset.page  || 'home';
    const logoSrc = body.dataset.logo  || '';

    /* 헤더 */
    const headerWrap = document.getElementById('site-header');
    if (headerWrap) {
      headerWrap.innerHTML = await fetchHTML('components/header.html');
      applyHeaderConfig(pageKey, logoSrc);
      initMenuJS(); /* 메뉴 이벤트 초기화 */
    }

    /* 푸터 */
    const footerWrap = document.getElementById('site-footer');
    if (footerWrap) {
      footerWrap.innerHTML = await fetchHTML('components/footer.html');
      applyFooterConfig(pageKey);
    }

    /* Back to Top 버튼 */
    initBackToTop(pageKey);
  }

  /* ── 메뉴 JS 초기화 (헤더 삽입 후 실행) ── */
  function initMenuJS() {

    /* 모바일 오버레이 토글 — 이미 페이지에서 정의된 경우 덮어쓰지 않음 */
    if (!window.toggleMenu) window.toggleMenu = function () {
      const overlay = document.getElementById('menu-overlay');
      if (!overlay) return;
      overlay.classList.toggle('open');
      document.getElementById('hamburger').classList.toggle('open');
      if (!overlay.classList.contains('open')) {
        document.querySelectorAll('.overlay-submenu').forEach(s => s.classList.remove('open'));
        document.querySelectorAll('.overlay-item-top').forEach(t => t.classList.remove('open'));
      }
    };

    if (!window.toggleOverlaySub) window.toggleOverlaySub = function (id, topEl) {
      const sub    = document.getElementById(id);
      const isOpen = sub.classList.contains('open');
      document.querySelectorAll('.overlay-submenu').forEach(s => s.classList.remove('open'));
      document.querySelectorAll('.overlay-item-top').forEach(t => t.classList.remove('open'));
      if (!isOpen) {
        sub.classList.add('open');
        topEl.classList.add('open');
      }
    };

    /* 데스크톱 서브메뉴 */
    const subState = { business: false, company: false };

    if (!window.toggleSub) window.toggleSub = function (name) {
      const isOpen = subState[name];
      Object.keys(subState).forEach(k => {
        subState[k] = false;
        const sub = document.getElementById('sub-' + k);
        if (sub) sub.classList.remove('open');
        const t = document.getElementById('title-' + k);
        if (t) t.classList.remove('open');
      });
      if (!isOpen) {
        subState[name] = true;
        const sub = document.getElementById('sub-' + name);
        if (sub) sub.classList.add('open');
        const t = document.getElementById('title-' + name);
        if (t) t.classList.add('open');
      }
    };

    /* index.html 전용: 마우스 휠로 서브메뉴 + hero 연동 */
    /* 각 페이지의 인라인 스크립트가 openAllSubs / closeAllSubs를 정의해 사용 */
    /* 여기서는 기본 toggleSub만 제공                                         */
  }

  /* ── DOMContentLoaded 시점에 실행 ── */
  document.addEventListener('DOMContentLoaded', loadComponents);

})();
