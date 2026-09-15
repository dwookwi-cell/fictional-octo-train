// ==UserScript==
// @name         Hunet 영상 끝나면 자동 다음
// @namespace    hunet-auto-next
// @match        https://study.hunet.co.kr/*
// @match        https://*.hunet.co.kr/*
// @match        about:blank
// @all-frames   true
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // ponytail: 실제 "다음" 버튼 selector를 모르는 상태라 휴리스틱 여러 개를 시도.
  // 안 눌리면 DevTools로 버튼 우클릭 → 검사 → 나온 selector를 이 배열 맨 앞에 추가.
  const NEXT_SELECTORS = [
    "#btnNext",
    ".btn-next",
    ".btnNext",
    'a[onclick*="Next" i]',
    'button[onclick*="Next" i]',
  ];

  function findNextButton() {
    for (const sel of NEXT_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    // 텍스트 기반 fallback: "다음" 또는 "Next" 를 포함하는 클릭 가능 요소
    const candidates = document.querySelectorAll("a, button, div[onclick], span[onclick]");
    for (const el of candidates) {
      const text = (el.textContent || "").trim();
      if (/^(다음|Next)\b/i.test(text)) return el;
    }
    return null;
  }

  function clickNext() {
    const btn = findNextButton();
    if (!btn) {
      console.warn("[hunet-auto-next] Next 버튼을 못 찾음. selector를 확인해서 스크립트 상단에 추가하세요.");
      return;
    }
    console.log("[hunet-auto-next] 영상 종료 감지 → 다음 클릭", btn);
    btn.click();
  }

  function attachToVideo(video) {
    if (video.dataset.hunetAutoNextAttached) return;
    video.dataset.hunetAutoNextAttached = "1";
    console.log("[hunet-auto-next] video 태그 발견, ended 리스너 부착:", video.currentSrc || video.src);
    video.addEventListener("ended", () => {
      // 완료 처리(진도 체크) 애니메이션/서버 반영 시간을 살짝 기다림
      setTimeout(clickNext, 1500);
    });
  }

  function scanVideos() {
    document.querySelectorAll("video").forEach(attachToVideo);
  }

  console.log("[hunet-auto-next] 스크립트 로드됨:", location.href, "video 태그 개수:", document.querySelectorAll("video").length);
  scanVideos();
  new MutationObserver(scanVideos).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
