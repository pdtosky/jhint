(function () {
  const originalFetch = window.fetch.bind(window);

  function parseBody(init) {
    if (!init || init.body === undefined || init.body === null) return null;
    if (typeof init.body === "string") {
      try {
        return JSON.parse(init.body);
      } catch {
        return init.body;
      }
    }
    return init.body;
  }

  function makeJsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }

  function getBridge() {
    try {
      return window.parent && window.parent !== window ? window.parent.smartSopBridge : null;
    } catch {
      return null;
    }
  }

  window.SOP_BRIDGE = {
    isAdminLoggedIn() {
      return Boolean(getBridge()?.isAdminLoggedIn?.());
    },
    uploadAttachment(options) {
      const bridge = getBridge();
      if (!bridge?.uploadAttachment) return Promise.reject(new Error("영상 업로드 연결을 찾을 수 없습니다."));
      return bridge.uploadAttachment(options);
    },
    resolveAttachmentUrl(file) {
      const bridge = getBridge();
      if (!bridge?.resolveAttachmentUrl) return Promise.reject(new Error("첨부영상 조회 연결을 찾을 수 없습니다."));
      return bridge.resolveAttachmentUrl(file);
    }
  };

  window.fetch = async function smartSopFetch(input, init = {}) {
    const requestUrl = typeof input === "string" ? input : input?.url;
    const url = new URL(requestUrl || "", window.location.origin);
    const isSmartSopApi = url.pathname.startsWith("/api/sops")
      || url.pathname.startsWith("/api/worker/sops")
      || url.pathname.startsWith("/api/work-records");

    if (!isSmartSopApi) {
      return originalFetch(input, init);
    }

    const bridge = getBridge();
    if (!bridge?.request) {
      return makeJsonResponse(503, { error: "생산일정관리 연결을 찾을 수 없습니다." });
    }

    try {
      const result = await bridge.request({
        method: String(init.method || "GET").toUpperCase(),
        path: url.pathname,
        search: url.search,
        body: parseBody(init)
      });
      return makeJsonResponse(result.status || 200, result.body || {});
    } catch (error) {
      return makeJsonResponse(error.status || 500, {
        error: error.message || "작업표준서 데이터를 처리하지 못했습니다."
      });
    }
  };
})();
