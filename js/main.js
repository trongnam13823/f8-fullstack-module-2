import elements from "./elements.js";
import Http from "./lib/Http.js";
import Toast from "./lib/Toast.js";
import Modal from "./lib/Modal.js";
import Tooltip from "./lib/Tooltip.js";
import ContextMenu from "./lib/ContextMenu.js";
import Dropdown from "./lib/Dropdown.js";
import Tabs from "./lib/Tabs.js";
import ProgressBar from "./lib/ProgressBar.js";

// ========== HELPERS ========== //
const BASE_URL = "https://spotify.f8team.dev";

function resolveImage(url, placeholder = "placeholder.svg") {
    if (!url || url.includes("example.com")) {
        return placeholder;
    }

    if (url.startsWith("/")) {
        url = BASE_URL + url;
    }

    return url;
}

function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

function formatDuration(duration) {
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

// ========== CONFIG & STATE ========== //

// HTTP client & Toast notification system
const http = new Http({ baseURL: BASE_URL + "/api" });
const toast = new Toast({ fadeTime: 100, visibleDuration: 3000 });

// Initialize tooltips
new Tooltip();

// Logged-in user state (null = guest)
let userInfo = null;

// library list
let myPlaylists = [];
let followingPlaylists = [];
let followingArtists = [];

// player
let currentPlaylistId = null;
let currentTracks = [];
let currentTrackIndex = -1;
let isSeek = false;

// ========== AUTH ========== //

// Auth modal (login/register forms)
const authModal = new Modal(elements["#authModal"], {
    closeBtn: "#modalClose",
    onClose: () => resetForms(["#signupBox form", "#loginBox form"]),
    closeOnOverlay: false,
});

// User avatar dropdown (profile menu, logout, etc.)
const userDropdown = new Dropdown(elements["#userAvatar"], elements["#userDropdown"]);

// --- Initialization flow --- //
// Load user state, attach UI actions, setup forms and password toggles
(async function initAuth() {
    await loadUser();
    bindUIActions();
    setupForms();
    initTogglePassword();
})();

// --- UI actions --- //
function bindUIActions() {
    elements["#signup-btn"].onclick = () => openForm("signup");
    elements["#login-btn"].onclick = () => openForm("login");

    elements["#showLogin"].onclick = () => showForm("login");
    elements["#showSignup"].onclick = () => showForm("signup");

    elements["#logoutBtn"].onclick = () => logout();
}

// Switch between login / signup forms inside modal
function showForm(type) {
    elements["#signupBox"].style.display = type === "signup" ? "block" : "none";
    elements["#loginBox"].style.display = type === "login" ? "block" : "none";
}

// Open modal with specific form
function openForm(type) {
    showForm(type);
    authModal.open();
}

// Show login/register buttons (when user is logged out)
function showAuthButtons() {
    const header = elements["#header-actions"];
    header.classList.contains("show-user")
        ? header.classList.replace("show-user", "show-auth")
        : header.classList.add("show-auth");
}

// Show user avatar + dropdown menu (when logged in)
function showUserMenu() {
    const header = elements["#header-actions"];

    if (header.classList.contains("show-auth")) {
        header.classList.replace("show-auth", "show-user");
    } else {
        header.classList.add("show-user");
    }

    elements["#userAvatar img"].src =
        userInfo?.avatar_url || `https://avatar.iran.liara.run/username?username=${userInfo?.display_name}`;
    elements["#userAvatar p"].textContent = userInfo?.display_name;
}

// --- Forms (signup & login) --- //
// Attach form handlers for login and signup
function setupForms() {
    handleForm("#signupBox", "/auth/register");
    handleForm("#loginBox", "/auth/login");
}

// Handle single form submission
function handleForm(boxId, endpoint) {
    const box = elements[boxId];
    if (!box) return;

    const form = box.querySelector("form");

    box.addEventListener("submit", async (e) => {
        e.preventDefault();
        setLoading(true, elements["#authModal-container"]);

        try {
            const { message, user, access_token, refresh_token } = await http.post(endpoint, {
                body: Object.fromEntries(new FormData(form).entries()),
            });

            updateUser(user, access_token, refresh_token);
            showUserMenu();
            authModal.close();
            toast.success(message);

            // Reset library view
            await loadAndRenderLibrary();
        } catch (error) {
            handleFormError(boxId, error);
        } finally {
            setLoading(false, elements["#authModal-container"]);
        }
    });

    // Clear error state once user types again
    form.querySelectorAll("input").forEach((input) =>
        input.addEventListener("input", () => input.parentElement.classList.remove("invalid"))
    );
}

// Reset multiple forms (clear input + remove error highlights)
function resetForms(formSelectors) {
    formSelectors.forEach((selector) => {
        const form = elements[selector];
        if (!form) return;
        form.reset();
        form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
    });
}

// Toggle show/hide password field
function initTogglePassword() {
    document.querySelectorAll(".toggle-password").forEach((button) =>
        button.addEventListener("click", () => {
            const input = button.previousElementSibling;
            const icon = button.querySelector("i");

            input.type = input.type === "password" ? "text" : "password";
            icon.classList.toggle("fa-eye-slash");
            icon.classList.toggle("fa-eye");
        })
    );
}

// Show or hide loading state in modal
function setLoading(isLoading, container) {
    isLoading ? container.classList.add("loading") : container.classList.remove("loading");
}

// Display form validation errors
function handleFormError(boxId, error) {
    if (error?.code === "VALIDATION_ERROR") {
        error.details.forEach((err) => {
            const input = elements[`${boxId} input[name='${err.field}']`];
            const formGroup = input.closest(".form-group");

            formGroup.classList.add("invalid");
            formGroup.querySelector(".error-message span").textContent = err.message;
        });
    } else {
        toast.error(error.message || "Error occurred");
    }
}

// --- Auth state management --- //
// Try loading current user (using stored tokens)
async function loadUser() {
    try {
        const { user } = await http.get("/users/me");
        userInfo = user;
        showUserMenu();
    } catch {
        clearAuth();
        showAuthButtons();
    } finally {
        await loadAndRenderLibrary();
    }
}

// Save user data + tokens
function updateUser(user, access_token, refresh_token) {
    userInfo = user;
    localStorage.setItem("access_token", access_token);
    localStorage.setItem("refresh_token", refresh_token);
}

// Logout user and reset UI
async function logout() {
    try {
        await http.post("/auth/logout", {
            body: { refresh_token: localStorage.getItem("refresh_token") },
        });
        userDropdown.close();

        clearAuth();
        showAuthButtons();
        await loadAndRenderLibrary();

        toast.success("Logged out successfully");
    } catch (error) {
        toast.error(error.message);
    }
}

// Clear tokens and reset user state
function clearAuth() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    userInfo = null;
}

// ========== HOME ========== //

// --- Initialization flow --- //
// Load Hits playlists and Artists on homepage
(async function initHome() {
    await loadAndRender({
        endpoint: "/playlists?limit=14&offset=0",
        container: elements["#hits-grid"],
        templateFn: hitTemplate,
        bindActionsFn: bindHitActions,
    });

    await loadAndRender({
        endpoint: "/artists?limit=14&offset=0",
        container: elements["#artists-grid"],
        templateFn: artistTemplate,
        bindActionsFn: bindArtistActions,
    });

    elements["#logo"].onclick = () => showPage("playlist-page");
    elements["#home-btn"].onclick = () => showPage("playlist-page");
})();

// --- Generic loader --- //
// Fetch data, render template, bind actions
async function loadAndRender({ endpoint, container, templateFn, bindActionsFn }) {
    try {
        const { playlists, artists } = await http.get(endpoint);
        const data = playlists || artists || [];

        container.innerHTML = data.map(templateFn).join("");
        bindActionsFn(container);
    } catch (error) {
        toast.error(`Failed to load data from ${endpoint}`);
        console.error(error);
    }
}

function showPage(pageName) {
    elements["#content-wrapper"].className = `content-wrapper ${pageName}`; // xóa class cũ, gán class mới
}

// ========== HITS ========== //

// Template for Hit card (playlist)
function hitTemplate(hit) {
    return `
        <div class="hit-card" data-id="${hit.id}" data-user_id="${hit.user_id}">
            <div class="hit-card-cover">
                <img 
                    src="${resolveImage(hit.image_url)}"
                    alt="${hit.name}"
                />
                <button class="hit-play-btn">
                    <i class="fas fa-play"></i>
                </button>
            </div>
            <div class="hit-card-info">
                <h3 class="hit-card-title">${hit.name}</h3>
                <p class="hit-card-artist">${hit.user_display_name ?? "Unknown"}</p>
            </div>
        </div>
    `;
}

// Bind play button for each Hit
function bindHitActions(container) {
    container.querySelectorAll(".hit-card").forEach((btn) => {
        btn.addEventListener("click", () => loadAndRenderHits(btn.dataset.id, userInfo?.id == btn.dataset.user_id));
    });
}

// ========== ARTISTS ========== //

// Template for Artist card
function artistTemplate(artist) {
    return `
        <div class="artist-card" data-id="${artist.id}">
            <div class="artist-card-cover">
                <img 
                    src="${resolveImage(artist.image_url)}"
                    alt="${artist.name}"
                />
                <button class="artist-play-btn">
                    <i class="fas fa-play"></i>
                </button>
            </div>
            <div class="artist-card-info">
                <h3 class="artist-card-name">${artist.name}</h3>
                <p class="artist-card-type">Artist</p>
            </div>
        </div>
    `;
}

// Bind play button for each Artist
function bindArtistActions(container) {
    container.querySelectorAll(".artist-card").forEach((btn) => {
        btn.addEventListener("click", () => loadAndRenderArtist(btn.dataset.id));
    });
}

// ========== PLAYLIST DETAIL PAGE ========== //
function renderPlaylistHero({ id, background_image_url, image_url, name, is_verified, monthly_listeners }, tracks) {
    elements["#playlist-detail-hero"].classList = `playlist-detail-hero artist-hero`;
    elements["#hero-background"].src = resolveImage(background_image_url ?? image_url);
    elements["#playlist-name"].textContent = name;

    if (monthly_listeners) {
        const textContent = monthly_listeners?.toLocaleString() + " monthly listeners";
        elements["#monthly-listeners"].textContent = textContent;
        elements["#monthly-listeners"].style.display = "block";
    } else {
        elements["#monthly-listeners"].style.display = "none";
    }

    if (is_verified) {
        elements["#verified-badge"].style.display = "flex";
    } else {
        elements["#verified-badge"].style.display = "none";
    }
}

function renderPlaylistControls(playlist, tracks, isArtist = false) {
    elements["#playPlaylistBtn"].style.display = tracks.length ? "flex" : "none";
    elements["#playPlaylistBtn"].dataset.id = playlist.id;

    elements["#followBtn"].style.display = userInfo && playlist.user_id !== userInfo?.id ? "flex" : "none";

    elements["#followBtn"].classList.toggle("active", playlist?.is_following);

    elements["#followBtn"].onclick = async () => {
        if (!userInfo) {
            toast.info(`Please log in to follow ${isArtist ? "artists" : "playlists"}.`);
            return;
        }

        try {
            if (playlist?.is_following) {
                await http.delete(`/${isArtist ? "artists" : "playlists"}/${playlist.id}/follow`);
                playlist.is_following = false;
                toast.success(`Unfollowed ${playlist.name}`);
            } else {
                await http.post(`/${isArtist ? "artists" : "playlists"}/${playlist.id}/follow`);
                playlist.is_following = true;
                toast.success(`Followed ${playlist.name}`);
            }

            elements["#followBtn"].classList.toggle("active", playlist?.is_following);

            if (isArtist) await loadAndRenderArtistFollowing();
            else await loadAndRenderPlaylistFollowing();
        } catch (error) {
            toast.error(error.message || "Action failed. Please try again.");
            console.error(error);
        }
    };

    if (playlist.id === currentPlaylistId) {
        elements["#playPlaylistBtn"].classList.toggle("playing", !elements["#player-audio"].paused);
    } else {
        elements["#playPlaylistBtn"].classList.remove("playing");
    }

    elements["#playPlaylistBtn"].onclick = () => {
        if (currentPlaylistId === playlist.id) {
            elements["#player-audio"].paused ? elements["#player-audio"].play() : elements["#player-audio"].pause();
        } else {
            elements["#track-list"].querySelector(".track-item")?.click();
        }
    };
}

function renderMyPlaylistModelEdit({ name, description, image_url }) {
    elements["#edit-playlist-image"].src = resolveImage(image_url);
    elements["#edit-playlist-name"].value = name;
    elements["#edit-playlist-desc"].value = description || "";
}

function renderMyPlaylistsHero(playlist) {
    const { id, name, image_url, is_public, user_display_name } = playlist;

    elements["#playlist-detail-hero"].classList = `playlist-detail-hero my-playlist-hero`;
    elements["#my-playlist-name"].textContent = name;
    elements["#hero__type"].textContent = is_public ? "Public Playlist" : "Private Playlist";
    elements["#hero__owner"].textContent = user_display_name;
    elements["#my-playlist-image"].src = resolveImage(image_url);

    elements["#my-playlist-name"].onclick = () => {
        renderMyPlaylistModelEdit(playlist);
        myPlaylistEditModal.open();
    };

    elements["#playlist-image-wrapper"].onclick = () => {
        renderMyPlaylistModelEdit(playlist);
        myPlaylistEditModal.open();
        elements["#edit-playlist-image-file"].click();
    };

    elements["#edit-playlist-form"].onsubmit = async (e) => {
        e.preventDefault();
        const updatedName = elements["#edit-playlist-name"].value.trim();
        const updatedDesc = elements["#edit-playlist-desc"].value.trim();
        const imageFile = elements["#edit-playlist-image-file"].files[0];

        if (updatedName === "") {
            toast.error("Playlist name cannot be empty.");
            return;
        }

        setLoading(true, elements["#myPlaylistEditModal-container"]);

        try {
            let imageUrl;

            // Nếu người dùng chọn ảnh mới → upload trước
            if (imageFile) {
                const formData = new FormData();
                formData.append("cover", imageFile);

                const { file } = await http.post(`/upload/playlist/${id}/cover`, {
                    body: formData,
                    headers: {},
                });

                imageUrl = BASE_URL + file.url;
            }

            // Gọi API update playlist
            const { playlist: updatedPlaylist, message } = await http.put(`/playlists/${id}`, {
                body: {
                    name: updatedName,
                    description: updatedDesc,
                    ...(imageUrl && { image_url: imageUrl }),
                },
            });

            //Cập nhật lại UI
            renderMyPlaylistsHero(updatedPlaylist);
            await loadAndRenderLibrary();

            toast.success(message || "Playlist updated successfully.");
            myPlaylistEditModal.close();
        } catch (error) {
            toast.error(error.message || "Failed to update playlist.");
            console.error(error);
        } finally {
            setLoading(false, elements["#myPlaylistEditModal-container"]);
        }
    };

    elements["#edit-playlist-image-wrapper"].onclick = () => {
        elements["#edit-playlist-image-file"].click();
    };

    elements["#edit-playlist-image-file"].onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const imageUrl = URL.createObjectURL(file);
        elements["#edit-playlist-image"].src = imageUrl;
    };
}

function renderPlaylistTracks(tracks, playlist, isArtist = false) {
    elements["#popular-section"].style.display = tracks.length ? "block" : "none";

    elements["#track-list"].innerHTML = tracks
        .map(
            (track, index) => `
                <div 
                    class="track-item 
                    ${
                        track.id === currentTracks[currentTrackIndex]?.id
                            ? `active ${elements["#player-audio"].paused ? "paused" : ""}`
                            : ""
                    }" 
                    data-id="${track.track_id ?? track?.id}" data-index="${index}"
                >
                    <div class="track-number">
                        <span>${index + 1}</span>
                        <i class="fas fa-volume-up playing-icon track-volume"></i>
                        <i class="fas fa-play playing-icon track-play"></i>
                        <i class="fas fa-pause playing-icon track-pause"></i>
                    </div>
                    <div class="track-image">
                        <img 
                            src="${resolveImage(track?.image_url ?? track.track_image_url)}" 
                            alt="${track?.title ?? track.track_title}" 
                            />
                    </div>
                    <div class="track-info">
                        <div class="track-name">${track?.title ?? track.track_title}</div>
                    </div>
                    <div class="track-plays">${track?.play_count ?? track.track_play_count?.toLocaleString()}</div>
                    <div class="track-duration">${formatDuration(track?.duration ?? track.track_duration)}</div>
                    <button class="track-menu-btn">
                        <i class="fas fa-ellipsis-h"></i>
                    </button>
                </div>
    `
        )
        .join("");

    elements["#track-list"].onclick = (e) => {
        const trackEL = e.target.closest(".track-item");
        if (!trackEL) return;

        document.querySelector("#track-list .track-item.active")?.classList?.remove("active");
        trackEL.classList.add("active");

        currentTracks = tracks;
        currentTrackIndex = trackEL.dataset.index;
        currentPlaylistId = playlist.id;

        const track = currentTracks[currentTrackIndex];
        const audio_url = track?.track_audio_url ?? track.audio_url;

        if (isArtist) track.artist_name = playlist.name;

        if (elements["#player-audio"].src === audio_url) {
            elements["#player-audio"].paused ? elements["#player-audio"].play() : elements["#player-audio"].pause();
        } else {
            renderPlayerInfo(track);
            elements["#player-audio"].play();
        }
    };
}

async function loadAndRenderArtist(id) {
    try {
        const [artists, { tracks }] = await Promise.all([
            http.get(`/artists/${id}`),
            http.get(`/artists/${id}/tracks/popular`),
        ]);

        renderPlaylistHero(artists, tracks);
        renderPlaylistTracks(tracks, artists, true);
        renderPlaylistControls(artists, tracks, true);

        showPage("playlist-detail-page");
    } catch (error) {
        toast.error(error.message);
    }
}

async function loadAndRenderHits(id, isMyPlaylist = false) {
    try {
        const [playlist, { tracks }] = await Promise.all([
            http.get(`/playlists/${id}`),
            http.get(`/playlists/${id}/tracks`),
        ]);

        isMyPlaylist ? renderMyPlaylistsHero(playlist, tracks) : renderPlaylistHero(playlist, tracks);
        renderPlaylistTracks(tracks, playlist);
        renderPlaylistControls(playlist, tracks);

        showPage("playlist-detail-page");
    } catch (error) {
        toast.error(error.message);
    }
}

// ========== LIBRARY ========== //
const libraryTabs = new Tabs("#sidebar", "active");

async function loadAndRenderLibrary() {
    if (!userInfo) {
        elements["#sidebar"].classList.add("hide");
        elements["#library-myPlaylists"].innerHTML = ``;
        elements["#library-followingArtists"].innerHTML = ``;
        elements["#library-message"].style.display = "block";
        return;
    }

    elements["#sidebar"].classList.remove("hide");
    elements["#library-message"].style.display = "none";

    try {
        const [myPlaylist, followedPlaylist, followedArtists] = await Promise.all([
            http.get(`/me/playlists`),
            http.get(`/me/playlists/followed?limit=20&offset=0`),
            http.get(`/me/following?limit=20&offset=0`),
        ]);

        myPlaylists = myPlaylist.playlists;
        followingPlaylists = followedPlaylist.playlists;
        followingArtists = followedArtists.artists;

        renderMyPlaylists(myPlaylists);
        renderFollowingPlaylists(followingPlaylists);
        renderFollowingArtists(followingArtists);
    } catch (error) {
        toast.error(error.message || "Failed to load your library.");
        console.error(error);
    }
}

async function loadAndRenderMyPlaylist() {
    try {
        const { playlists } = await http.get(`/me/playlists`);
        myPlaylists = playlists;

        renderMyPlaylists(myPlaylists);
    } catch (error) {
        toast.error(error.message || "Failed to load your playlists.");
        console.error(error);
    }
}

async function loadAndRenderArtistFollowing() {
    try {
        const { artists } = await http.get(`/me/following?limit=20&offset=0`);
        followingArtists = artists;

        renderFollowingArtists(artists);
    } catch (error) {
        toast.error(error.message || "Failed to load your following artists.");
        console.error(error);
    }
}

async function loadAndRenderPlaylistFollowing() {
    try {
        const { playlists } = await http.get(`/me/playlists/followed?limit=20&offset=0`);
        followingPlaylists = playlists;

        renderFollowingPlaylists(playlists);
    } catch (error) {
        toast.error(error.message || "Failed to load your following playlists.");
        console.error(error);
    }
}

function renderMyPlaylists(playlists) {
    elements["#library-myPlaylists"].innerHTML =
        playlists.length > 0
            ? playlists
                  .map(
                      (playlist) => `
                    <div 
                        class="library-item" 
                        data-id="${playlist.id}" 
                        data-user_id="${playlist.user_id}" 
                        data-is_public="${playlist.is_public}"
                        data-context="myPlaylists"
                    >
                        <img 
                            src="${resolveImage(playlist.image_url)}" 
                            alt="${playlist.name}" 
                            class="item-image"
                            data-tooltip="${playlist.name}"
                            data-placement="right"
                        />
                        <div class="item-info">
                            <div class="item-title">${playlist.name}</div>
                                <div class="item-subtitle">${playlist.total_tracks} songs
                            </div>
                        </div>
                    </div>`
                  )
                  .join("")
            : `<p class="library-message" id="library-message">You have no playlists yet. Create one to get started!</p>`;

    document.querySelectorAll("#library-myPlaylists .library-item").forEach((item) => {
        item.addEventListener("click", () => loadAndRenderHits(item.dataset.id, userInfo?.id == item.dataset.user_id));
    });

    if (window.myPlaylistMenu) {
        window.myPlaylistMenu.destroy();
    }

    window.myPlaylistMenu = new ContextMenu("#myPlaylists-menu", {
        target: '[data-context="myPlaylists"]',
        onBeforeShow(menu, target) {
            const isPrivate = target.dataset.is_public === "0";
            const privacyItem = menu.querySelector(".privacy");
            privacyItem.textContent = isPrivate ? "Make Public" : "Make Private";
            privacyItem.dataset.action = isPrivate ? "make-public" : "make-private";
        },
        async onAction(action, target) {
            const id = target.dataset.id;

            try {
                switch (action) {
                    case "make-private":
                    case "make-public":
                        // Gọi API update playlist
                        await http.put(`/playlists/${id}`, {
                            body: { is_public: action === "make-public" ? 1 : 0 },
                        });

                        toast.success(`Playlist is now ${action === "make-public" ? "Public" : "Private"}.`);
                        await loadAndRenderMyPlaylist();

                        break;
                    case "delete":
                        // Gọi API delete playlist
                        await http.delete(`/playlists/${id}`);

                        toast.success("Playlist deleted successfully.");
                        await loadAndRenderMyPlaylist();
                        break;

                    default:
                        break;
                }
            } catch (error) {
                toast.error(error.message);
                console.error(error);
            }
        },
    });
}

function renderFollowingPlaylists(playlists) {
    elements["#library-followingPlaylists"].innerHTML =
        playlists.length > 0
            ? playlists
                  .map(
                      (playlist) => `
                    <div 
                        class="library-item" 
                        data-id="${playlist.id}" 
                        data-user_id="${playlist.user_id}" 
                        data-context="followingPlaylists"
                    >
                        <img 
                            src="${resolveImage(playlist.image_url)}" 
                            alt="${playlist.name}" 
                            class="item-image" 
                            title="${playlist.name}" 
                            data-tooltip="${playlist.name}"
                            data-placement="right"
                        />
                        <div class="item-info">
                            <div class="item-title">${playlist.name}</div>
                                <div class="item-subtitle">${playlist.total_tracks} songs
                            </div>
                        </div>
                    </div>`
                  )
                  .join("")
            : `<p class="library-message" id="library-message">You have no playlists yet. Create one to get started!</p>`;

    document.querySelectorAll("#library-followingPlaylists .library-item").forEach((item) => {
        item.addEventListener("click", () => loadAndRenderHits(item.dataset.id, userInfo?.id == item.dataset.user_id));
    });

    if (window.followingPlaylistsMenu) {
        window.followingPlaylistsMenu.destroy();
    }

    window.followingPlaylistsMenu = new ContextMenu("#followingPlaylists-menu", {
        target: '[data-context="followingPlaylists"]',
        async onAction(action, target) {
            const id = target.dataset.id;

            try {
                switch (action) {
                    case "remove":
                        // Gọi API delete playlist
                        await http.delete(`/playlists/${id}/follow`);

                        toast.success("Removed playlist from your library.");
                        await loadAndRenderPlaylistFollowing();
                        break;

                    default:
                        break;
                }
            } catch (error) {
                toast.error(error.message);
                console.error(error);
            }
        },
    });
}

function renderFollowingArtists(artists) {
    elements["#library-followingArtists"].innerHTML =
        artists.length > 0
            ? artists
                  .map(
                      (artist) => `
                    <div class="library-item" data-id="${artist.id}" data-context="followingArtists">
                       <img 
                            src="${resolveImage(artist.image_url)}" 
                            alt="${artist.name}" 
                            class="item-image" 
                            title="${artist.name}" 
                            data-tooltip="${artist.name}"
                            data-placement="right"
                        />
                        <div class="item-info">
                            <div class="item-title">${artist.name}</div>
                        </div>
                    </div>`
                  )
                  .join("")
            : `<p class="library-message" id="library-message">You are not following any artists yet. Explore and follow your favorite artists!</p>`;

    document.querySelectorAll("#library-followingArtists .library-item").forEach((item, index) => {
        item.onclick = () => loadAndRenderArtist(item.dataset.id);
    });

    if (window.followingArtistsMenu) {
        window.followingArtistsMenu.destroy();
    }

    window.followingArtistsMenu = new ContextMenu("#followingArtists-menu", {
        target: '[data-context="followingArtists"]',
        async onAction(action, target) {
            const id = target.dataset.id;

            try {
                switch (action) {
                    case "unfollow":
                        // Gọi API unfollow artists
                        await http.delete(`/artists/${id}/follow`);

                        toast.success("Unfollowed artist successfully.");
                        await loadAndRenderArtistFollowing();
                        break;

                    default:
                        break;
                }
            } catch (error) {
                toast.error(error.message);
                console.error(error);
            }
        },
    });
}

// ========== LIBRARY SEARCH ========== //
elements["#search-library-btn"].addEventListener("click", () => {
    elements["#search-library"].classList.add("expanded");
});

elements["#search-library-input"].addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();

    if (libraryTabs.idActive === "myPlaylists") {
        renderMyPlaylists(myPlaylists.filter((pl) => pl.name.toLowerCase().includes(query)));
    }

    if (libraryTabs.idActive === "followingArtists") {
        renderFollowingArtists(followingArtists.filter((ar) => ar.name.toLowerCase().includes(query)));
    }

    if (libraryTabs.idActive === "followingPlaylists") {
        renderFollowingPlaylists(followingPlaylists.filter((pl) => pl.name.toLowerCase().includes(query)));
    }
});

elements["#search-library-input"].addEventListener("blur", (e) => {
    elements["#search-library"].classList.remove("expanded");
    e.target.value = "";
    e.target.dispatchEvent(new Event("input"));
});

// ========== LIBRARY SORTING ========== //
const sortDropdown = new Dropdown(elements["#sort-toggle"], elements["#sort-menu"]);

document.querySelectorAll(".sort__view-btn").forEach((button) => {
    button.addEventListener("click", () => {
        document.querySelector(".sort__view-btn.active").classList.remove("active");
        button.classList.add("active");
        const view = button.dataset.view;
        elements["#library-content"].classList.toggle("compact-list", view === "compact-list");
        elements["#library-content"].classList.toggle("default-list", view === "default-list");
        elements["#library-content"].classList.toggle("compact-grid", view === "compact-grid");
        elements["#library-content"].classList.toggle("default-grid", view === "default-grid");
    });
});

document.querySelectorAll(".sort__option").forEach((button) => {
    button.addEventListener("click", () => {
        document.querySelector(".sort__option.active").classList.remove("active");
        button.classList.add("active");
        const sort = button.dataset.sort;

        console.log(libraryTabs.idActive);

        if (sort === "a-z") {
            renderMyPlaylists(myPlaylists.sort((a, b) => a.name.localeCompare(b.name)));
            renderFollowingPlaylists(followingPlaylists.sort((a, b) => a.name.localeCompare(b.name)));
            renderFollowingArtists(followingArtists.sort((a, b) => a.name.localeCompare(b.name)));
        } else if (sort === "z-a") {
            renderMyPlaylists(myPlaylists.sort((a, b) => b.name.localeCompare(a.name)));
            renderFollowingPlaylists(followingPlaylists.sort((a, b) => b.name.localeCompare(a.name)));
            renderFollowingArtists(followingArtists.sort((a, b) => b.name.localeCompare(a.name)));
        } else if (sort === "recents") {
            renderMyPlaylists(myPlaylists.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
            renderFollowingPlaylists(
                followingPlaylists.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
            );
            renderFollowingArtists(followingArtists.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
        }
    });
});

// ========== SEARCH TRACKS ========== //
function renderSearchTrackList(tracks) {
    elements["#search-track-list"].style.display = "block";
    elements["#search-track-list"].innerHTML =
        tracks.length > 0
            ? tracks
                  .map(
                      (track, index) => `
                        <div
                            class="search-track-item"
                            data-id="${track.id}"
                            data-index="${index}"
                        >
                            <div class="track-image">
                                <img
                                    src="${resolveImage(track.image_url)}"
                                    alt="${track.title}"
                                />
                            </div>
                            <div class="track-info"><div class="track-name">${track.title}</div></div>
                        </div>`
                  )
                  .join("")
            : `<p class="search-track-message">No tracks found.</p>`;

    elements["#search-track-list"].onclick = (e) => {
        const trackEL = e.target.closest(".search-track-item");
        if (!trackEL) return;

        currentTracks = [tracks[trackEL.dataset.index]];
        currentTrackIndex = 0;
        currentPlaylistId = null;

        const track = currentTracks[currentTrackIndex];

        renderPlayerInfo(track);
        elements["#player-audio"].play();
    };
}

const handleSearchTracksInput = debounce(async (query) => {
    if (query === "") {
        elements["#search-track-list"].style.display = "none";
        return;
    }

    try {
        const { tracks } = await http.get(`/tracks?limit=20&offset=0&q=${encodeURIComponent(query)}`);

        renderSearchTrackList(tracks);
    } catch (error) {
        toast.error("Search failed. Please try again.");
        console.error(error);
    }
}, 300);

elements["#search-tracks-input"].addEventListener("input", (e) => {
    const query = e.target.value.trim();
    handleSearchTracksInput(query);
});

elements["#search-tracks-input"].addEventListener("blur", (e) => {
    e.target.value = "";
    e.target.dispatchEvent(new Event("input"));
});

// ========== CREATE PLAYLIST ========== //
elements["#createPlaylistBtn"].addEventListener("click", async () => {
    try {
        const { playlist } = await http.post("/playlists", { body: { name: "My Playlist" } });
        toast.success("Playlist created successfully");
        await loadAndRenderMyPlaylist();
        libraryTabs.activate("myPlaylists");
    } catch (error) {}
});

// ========== MODAL FOR EDIT MY PLAYLIST ========== //
// Auth modal (login/register forms)
const myPlaylistEditModal = new Modal(elements["#myPlaylistEditModal"], {
    closeBtn: "#modalClose",
});

// ========== PLAYER ========== //
elements["#player-audio"].addEventListener("play", () => {
    elements["#player-play-btn"].classList.add("playing");
    if (elements["#playPlaylistBtn"].dataset.id === currentPlaylistId) {
        elements["#playPlaylistBtn"].classList.add("playing");
    }
    document.querySelector(".track-item.active")?.classList?.remove("paused");
});

elements["#player-audio"].addEventListener("pause", () => {
    elements["#player-play-btn"].classList.remove("playing");
    if (elements["#playPlaylistBtn"].dataset.id === currentPlaylistId) {
        elements["#playPlaylistBtn"].classList.remove("playing");
    }
    document.querySelector(".track-item.active")?.classList?.add("paused");
});

elements["#player-audio"].addEventListener("timeupdate", (e) => {
    if (!isSeek) {
        elements["#current-time"].textContent = formatDuration(e.target.currentTime);
        const progress = (e.target.currentTime / e.target.duration) * 100 + "%";
        elements["#progress-fill"].style.width = progress;
        elements["#progress-handle"].style.left = progress;
    }
});

elements["#player-audio"].addEventListener("ended", (e) => {
    changeTrack(1);
});

elements["#player-play-btn"].addEventListener("click", (e) => {
    elements["#player-audio"].paused ? elements["#player-audio"].play() : elements["#player-audio"].pause();
});

function getNextTrackIndex(step) {
    const length = currentTracks.length;
    if (length === 0) return -1;
    return (Number(currentTrackIndex) + step + length) % length;
}

function changeTrack(step) {
    const newIndex = getNextTrackIndex(step);
    if (newIndex === -1) return;

    currentTrackIndex = newIndex;
    const track = currentTracks[newIndex];

    // Cập nhật UI
    document.querySelector(".track-item.active")?.classList?.remove("active");
    document.querySelector(`.track-item[data-id="${track?.track_id ?? track.id}"]`)?.classList?.add("active");

    renderPlayerInfo(track);
    elements["#player-audio"].play();
}

elements["#player-next-btn"].addEventListener("click", () => changeTrack(1));
elements["#player-prev-btn"].addEventListener("click", () => changeTrack(-1));

function renderPlayerInfo(track) {
    elements["#btn-like-songs"].dataset.id = track?.track_id ?? track.id;
    elements["#player-image"].src = track?.track_image_url ?? track.image_url;
    elements["#player-audio"].src = track?.track_audio_url ?? track.audio_url;
    elements["#player-title"].textContent = track?.track_title ?? track.title;
    elements["#player-artist"].textContent = track?.artist_name;
    elements["#current-time"].textContent = "00:00";
    elements["#duration-time"].textContent = formatDuration(track?.duration ?? track.track_duration);

    elements["#player"].classList.add("active");
}

const progress = new ProgressBar("#progress-bar");

progress.onStart((v) => (isSeek = true));
progress.onEnd((v) => {
    isSeek = false;
    if (elements["#player-audio"].src) {
        elements["#player-audio"].currentTime = (v * elements["#player-audio"].duration) / 100;
    }
});
