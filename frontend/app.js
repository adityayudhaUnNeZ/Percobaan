(function () {
  const API = "http://localhost:5000";
  const $ = (id) => document.getElementById(id);

  const audio = $("audio");
  const poster = $("poster");
  const btnPlay = $("btnPlay");
  const btnMute = $("btnMute");
  const iconPlay = $("iconPlay");
  const iconVolume = $("iconVolume");
  const seekBar = $("seekBar");
  const listenerCount = $("listenerCount");
  const listenerUpdated = $("listenerUpdated");
  const liveLabel = $("liveLabel");
  const btnShare = $("btnShare");
  const linkInstagram = $("linkInstagram");
  const linkTiktok = $("linkTiktok");
  const linkYoutube = $("linkYoutube");
  const tabSalam = $("tabSalam");
  const tabRequest = $("tabRequest");
  const formMain = $("formMain");
  const fieldName = $("fieldName");
  const fieldSecond = $("fieldSecond");
  const fieldMessage = $("fieldMessage");
  const hint = $("hint");
  const formStatus = $("formStatus");

  const radioPanel = $("radioPanel");
  const state = {
    stationName: "Minkes Radio",
    city: "Semarang",
    programTitle: "On Air",
    hosts: ["Isul", "Laily"],
    scheduleText: "Rabu, 4 Februari 2026 10.00-11.00 WIB",
    listenersText: "",
    topicText: "Topics: UHC",
    streamUrl: "http://172.16.10.94:8000/radio",
    posterUrl: "assets/images/poster.jpeg",
    links: {
      youtube: "https://www.youtube.com/@dinkessemarangkota",
      instagram: "https://www.instagram.com/dkksemarang/",
      tiktok: "https://www.tiktok.com/@dkksemarang",
    },
  };
  let isPlaying = false;
  let fakeProgressTimer = null;
  let liveSource = null;
  let livePollTimer = null;
  let activeTab = "salam";
  let formStatusTimer = null;
  let formStatusHideTimer = null;

  function setHint(text) {
    if (!hint) return;
    hint.textContent = text;
  }

  function setFormStatus(text, type = "info") {
    if (!formStatus) return;
    if (formStatusTimer) {
      window.clearTimeout(formStatusTimer);
      formStatusTimer = null;
    }
    if (formStatusHideTimer) {
      window.clearTimeout(formStatusHideTimer);
      formStatusHideTimer = null;
    }

    formStatus.style.transition = "opacity 240ms ease, transform 240ms ease";

    if (!text) {
      formStatus.style.opacity = "0";
      formStatus.style.transform = "translateY(-4px)";
      formStatusHideTimer = window.setTimeout(() => {
        formStatus.textContent = "";
        formStatus.style.display = "none";
      }, 240);
      return;
    }

    const styles = {
      success: { bg: "#dcfce7", color: "#166534", border: "#86efac" },
      error: { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
      info: { bg: "#e0f2fe", color: "#075985", border: "#7dd3fc" },
    };
    const picked = styles[type] || styles.info;

    formStatus.textContent = text;
    formStatus.style.display = "inline-block";
    formStatus.style.marginTop = "8px";
    formStatus.style.padding = "6px 10px";
    formStatus.style.borderRadius = "999px";
    formStatus.style.fontSize = "12px";
    formStatus.style.fontWeight = "600";
    formStatus.style.backgroundColor = picked.bg;
    formStatus.style.color = picked.color;
    formStatus.style.border = `1px solid ${picked.border}`;
    formStatus.style.opacity = "0";
    formStatus.style.transform = "translateY(-4px)";

    window.requestAnimationFrame(() => {
      formStatus.style.opacity = "1";
      formStatus.style.transform = "translateY(0)";
    });

    formStatusTimer = window.setTimeout(() => {
      setFormStatus("");
    }, 5000);
  }

  function setPlayUi(playing) {
    isPlaying = playing;
    if (iconPlay) {
      iconPlay.textContent = playing ? "pause" : "play_arrow";
    }
    btnPlay.title = playing ? "Pause" : "Play";
    if (liveLabel) {
      liveLabel.classList.toggle("live-on", playing);
    }
  }

  function setMuteUi(muted) {
    if (iconVolume) {
      iconVolume.textContent = muted ? "volume_off" : "volume_up";
    }
    btnMute.title = muted ? "Unmute" : "Mute";
  }

  function startFakeProgress() {
    stopFakeProgress();
    let value = 0;
    fakeProgressTimer = window.setInterval(() => {
      // Live streams don't have real progress; animate subtly.
      value = (value + 1) % 100;
      if (seekBar) seekBar.style.width = `${value}%`;
    }, 500);
  }

  function stopFakeProgress() {
    if (fakeProgressTimer) window.clearInterval(fakeProgressTimer);
    fakeProgressTimer = null;
    if (seekBar) seekBar.style.width = "40%";
  }

  function renderState() {
    const links = state?.links || {};
    const stationName = state?.stationName || "Minkes Radio";
    document.title = stationName;

    if (listenerCount)
      listenerCount.textContent = state?.listenersText || "Memuat...";
    if (listenerUpdated && listenerUpdated.textContent.trim() === "") {
      listenerUpdated.textContent = "Terakhir update --.-- WIB";
    }
    if (linkInstagram && links.instagram) linkInstagram.href = links.instagram;
    if (linkTiktok && links.tiktok) linkTiktok.href = links.tiktok;
    if (linkYoutube && links.youtube) linkYoutube.href = links.youtube;
    const posterUrl = state?.posterUrl;
    if (posterUrl) poster.src = posterUrl;

    const hasStream = Boolean(state?.streamUrl);
    setHint(
      hasStream
        ? "Tap play untuk mulai mendengar."
        : "Setel URL stream untuk mulai memutar."
    );
  }

  async function togglePlay() {
    if (!state?.streamUrl) {
      setHint("Stream URL belum diatur. Silakan isi URL stream.");
      return;
    }

    if (!audio.src || audio.src !== state.streamUrl) {
      audio.src = state.streamUrl;
    }

    try {
      if (audio.paused) {
        setPlayUi(true);
        await audio.play();
      } else {
        setPlayUi(false);
        audio.pause();
      }
    } catch (e) {
      setHint(
        "Gagal memutar. Pastikan Stream URL valid dan mendukung CORS/HTTPS."
      );
      setPlayUi(false);
      stopFakeProgress();
    }
  }

  btnPlay.addEventListener("click", () => {
    togglePlay();
  });

  btnMute.addEventListener("click", () => {
    audio.muted = !audio.muted;
    setMuteUi(audio.muted);
  });

  if (btnShare) {
    btnShare.addEventListener("click", async () => {
      const payload = {
        title: document.title,
        text: state?.programTitle
          ? `${state.programTitle} - ${state.stationName || "Minkes Radio"}`
          : document.title,
        url: window.location.href,
      };
      try {
        if (navigator.share) {
          await navigator.share(payload);
        } else {
          await navigator.clipboard.writeText(payload.url);
          setHint("Link disalin ke clipboard.");
          window.setTimeout(() => renderState(), 2000);
        }
      } catch {
        // ignore
      }
    });
  }

  audio.addEventListener("play", () => {
    setPlayUi(true);
    startFakeProgress();
    setHint("Sedang memutar...");
  });

  audio.addEventListener("pause", () => {
    setPlayUi(false);
    stopFakeProgress();
    renderState();
  });

  audio.addEventListener("error", () => {
    setPlayUi(false);
    stopFakeProgress();
    setHint("Tidak bisa memuat stream. Cek URL dan koneksi.");
  });

  function formatListenerText(count) {
    return `${count} Listener`;
  }

  function formatUpdatedTime(iso) {
    if (!iso) return "Terakhir update --.-- WIB";
    const date = new Date(iso);
    const time = date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `Terakhir update ${time} WIB`;
  }

  function updateListenerUi(count, updatedAt) {
    if (listenerCount) listenerCount.textContent = formatListenerText(count);
    if (listenerUpdated)
      listenerUpdated.textContent = formatUpdatedTime(updatedAt);
  }

  async function fetchListenerOnce() {
    try {
      const res = await fetch("/api/listeners", { cache: "no-store" });
      if (!res.ok) throw new Error("listener fetch failed");
      const data = await res.json();
      if (typeof data?.count === "number") {
        updateListenerUi(data.count, data.updatedAt);
      }
    } catch {
      // fallback: show zero when API fails\n      updateListenerUi(0, null);
    }
  }

  function stopLivePolling() {
    if (livePollTimer) window.clearInterval(livePollTimer);
    livePollTimer = null;
  }

  function startLivePolling() {
    stopLivePolling();
    fetchListenerOnce();
    livePollTimer = window.setInterval(fetchListenerOnce, 8000);
  }

  function stopLiveSource() {
    if (liveSource) liveSource.close();
    liveSource = null;
  }

  function startLiveListeners() {
    if ("EventSource" in window) {
      stopLiveSource();
      liveSource = new EventSource("/api/live-listeners");
      liveSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (typeof data?.count === "number") {
            updateListenerUi(data.count, data.updatedAt);
          }
        } catch {
          // ignore malformed payload
        }
      };
      liveSource.onerror = () => {
        stopLiveSource();
        startLivePolling();
      };
    } else {
      startLivePolling();
    }
  }

  function setActiveTab(tab) {
    activeTab = tab === "request" ? "request" : "salam";
    const isSalam = activeTab === "salam";
    if (formMain) {
      formMain.style.transition = "opacity 220ms ease, transform 220ms ease";
      formMain.style.opacity = "0.6";
      formMain.style.transform = "translateY(4px)";
      window.requestAnimationFrame(() => {
        formMain.style.opacity = "1";
        formMain.style.transform = "translateY(0)";
      });
    }

    if (tabSalam) {
      tabSalam.classList.toggle("tab-pill-active", isSalam);
      tabSalam.setAttribute("aria-pressed", isSalam ? "true" : "false");
    }
    if (tabRequest) {
      tabRequest.classList.toggle("tab-pill-active", !isSalam);
      tabRequest.setAttribute("aria-pressed", !isSalam ? "true" : "false");
    }

    if (fieldSecond) {
      fieldSecond.placeholder = isSalam ? "Asal" : "Penyanyi";
    }
    if (fieldMessage) {
      fieldMessage.placeholder = isSalam ? "Titip Salam" : "Judul Lagu";
    }
    if (fieldName) {
      fieldName.placeholder = "Nama";
    }
    setFormStatus("");
  }

  if (tabSalam) tabSalam.addEventListener("click", () => setActiveTab("salam"));
  if (tabRequest)
    tabRequest.addEventListener("click", () => setActiveTab("request"));

  function setupMainForm() {
    if (!formMain || !fieldName || !fieldSecond || !fieldMessage) return;

    formMain.addEventListener("submit", async (event) => {
      event.preventDefault();

      const name = fieldName.value.trim();
      const second = fieldSecond.value.trim();
      const message = fieldMessage.value.trim();

      if (!name || !message) {
        setFormStatus("Nama dan isi form wajib diisi.", "error");
        return;
      }

      const endpoint =
        activeTab === "salam" ? API + "/api/greetings" : API + "/api/requests";
      const payload =
        activeTab === "salam"
          ? { name, origin: second, message }
          : { name, artist: second, song_title: message, message: "" };

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("submit failed");

        formMain.reset();
        if (activeTab === "salam") {
          setFormStatus("Titip salam berhasil dikirim.", "success");
        } else {
          setFormStatus("Request lagu berhasil dikirim.", "success");
        }
      } catch {
        setFormStatus("Gagal kirim formulir. Coba lagi.", "error");
      }
    });
  }

  setPlayUi(false);
  setMuteUi(false);
  setActiveTab("salam");
  renderState();
  startLiveListeners();
  setupMainForm();
})();
