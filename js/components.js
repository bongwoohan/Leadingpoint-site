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
      navActiveId:     'nav-home-link',   // nav에서 active 처리할 링크 id
      ovActiveId:      'ov-home-link',    // 오버레이에서 active 처리할 id
      ovBusinessOpen:  false,             // 오버레이에서 Business 서브메뉴 기본 열림 여부
      ovBusinessActive: false,            // 오버레이 Business 라벨 active 여부
      footActiveId:    null,              // 푸터 active 링크 id
    },
    'disaster-recovery': {
      navActiveId:     'nav-dr',
      ovActiveId:      'ov-dr',
      ovBusinessOpen:  true,
      ovBusinessActive: true,
      footActiveId:    'foot-dr',
    },
    'active-active-nas-dr': {
      navActiveId:     'nav-nas-dr',
      ovActiveId:      'ov-nas-dr',
      ovBusinessOpen:  true,
      ovBusinessActive: true,
      footActiveId:    'foot-nas-dr',
    },
    'cloud': {
      navActiveId:     'nav-cloud',
      ovActiveId:      'ov-cloud',
      ovBusinessOpen:  true,
      ovBusinessActive: true,
      footActiveId:    'foot-cloud',
    },
    'biometrics': {
      navActiveId:     'nav-bio',
      ovActiveId:      'ov-bio',
      ovBusinessOpen:  true,
      ovBusinessActive: true,
      footActiveId:    'foot-bio',
    },
    'partners': {
      navActiveId:     'nav-partners',
      ovActiveId:      'ov-partners',
      ovBusinessOpen:  false,
      ovBusinessActive: false,
      footActiveId:    'foot-partners',
    },
    'clients': {
      navActiveId:     'nav-clients',
      ovActiveId:      'ov-clients',
      ovBusinessOpen:  false,
      ovBusinessActive: false,
      footActiveId:    'foot-clients',
    },
    'company': {
      navActiveId:     'nav-contact',
      ovActiveId:      'ov-contact',
      ovBusinessOpen:  false,
      ovBusinessActive: false,
      footActiveId:    'foot-contact',
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
