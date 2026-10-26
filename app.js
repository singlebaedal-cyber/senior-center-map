/**
 * 경로당 주소 일괄 등록 & 지도 관리자 (Senior Center Map Manager)
 * Official Native Kakao Maps API Integration & Smart Geocoding Engine
 */

const DEFAULT_STATUSES = [
    { id: "unvisited", label: "미방문", color: "#e53935", icon: "🔴" },
    { id: "completed", label: "완료", color: "#00c853", icon: "🟢" },
    { id: "contacting", label: "연락중", color: "#ff6d00", icon: "🟠" }
];

// 20 Visually Distinct High-Contrast Curated Colors (시인성 극대화 20색)
const PALETTE_20_COLORS = [
    { color: "#e53935", name: "빨강 (Red)", emoji: "🔴" },
    { color: "#ff6d00", name: "선명주황 (Orange)", emoji: "🟠" },
    { color: "#ffd600", name: "레몬노랑 (Yellow)", emoji: "🟡" },
    { color: "#76ff03", name: "라임연두 (Lime)", emoji: "🟢" },
    { color: "#00c853", name: "비비드초록 (Green)", emoji: "🟢" },
    { color: "#1b5e20", name: "딥그린 (Forest)", emoji: "🌲" },
    { color: "#00b4d8", name: "하늘시안 (Cyan)", emoji: "💠" },
    { color: "#004d40", name: "심해청록 (Teal)", emoji: "🌊" },
    { color: "#2979ff", name: "코발트파랑 (Blue)", emoji: "🔵" },
    { color: "#0d276b", name: "다크네이비 (Navy)", emoji: "⚓" },
    { color: "#aa00ff", name: "비비드보라 (Purple)", emoji: "🟣" },
    { color: "#4a148c", name: "딥바이올렛 (Indigo)", emoji: "🔮" },
    { color: "#f50057", name: "핫핑크 (Magenta)", emoji: "💗" },
    { color: "#ff80ab", name: "베이비핑크 (Pink)", emoji: "🌸" },
    { color: "#d84315", name: "적갈색 (Terracotta)", emoji: "🧱" },
    { color: "#4e342e", name: "에스프레소 (Brown)", emoji: "🪵" },
    { color: "#f9a825", name: "머스타드골드 (Gold)", emoji: "🍯" },
    { color: "#827717", name: "올리브카키 (Olive)", emoji: "🫒" },
    { color: "#78909c", name: "슬레이트그레이 (Gray)", emoji: "🔘" },
    { color: "#1a1a1a", name: "칠흑블랙 (Black)", emoji: "⚫" }
];

let selectedNewStatusColor = "#00c853";

function getStatusIcon(st) {
    if (!st) return "🔴";
    // Check color match against 20-color palette FIRST so color edits immediately update the icon
    if (st.color) {
        const found = PALETTE_20_COLORS.find(p => p.color.toLowerCase() === st.color.toLowerCase());
        if (found && found.emoji) return found.emoji;
    }
    if (st.icon && st.icon !== "●" && st.icon !== "📌" && st.icon !== "" && st.icon !== "🏷️") {
        return st.icon;
    }
    if (st.id === "unvisited") return "🔴";
    if (st.id === "completed") return "🟢";
    if (st.id === "contacting") return "🟠";
    return "🏷️";
}

function getContrastTextColor(hexColor) {
    if (!hexColor) return "#ffffff";
    const hex = hexColor.replace("#", "");
    if (hex.length !== 6) return "#ffffff";
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 170) ? "#111827" : "#ffffff";
}

function renderStatusOptionsHtml(selectedStatusId) {
    return state.customStatuses.map(st => {
        const isSelected = st.id === selectedStatusId;
        const icon = getStatusIcon(st);
        const color = st.color || "#3b82f6";
        return `<option value="${st.id}" ${isSelected ? 'selected' : ''} style="background:#ffffff; color:${color}; font-weight:700; padding:6px 10px;">${icon} ${escapeHtml(st.label)}</option>`;
    }).join('');
}

function getDefaultStatusId() {
    if (state.customStatuses && state.customStatuses.length > 0 && state.customStatuses[0].id) {
        return state.customStatuses[0].id;
    }
    return "unvisited";
}

function normalizePlaceStatus(statusId) {
    const defaultId = getDefaultStatusId();
    if (!statusId || statusId === "unselected" || statusId === "verified") {
        return defaultId;
    }
    const exists = state.customStatuses && state.customStatuses.some(s => s.id === statusId);
    return exists ? statusId : defaultId;
}

// Global State - Pre-populate from LocalStorage for instant zero-delay loading
let _initialStoredPlaces = [];
try {
    const raw = localStorage.getItem("senior_center_places");
    if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) _initialStoredPlaces = parsed;
    }
} catch (e) {}

let _initialStoredGroups = [];
try {
    const raw = localStorage.getItem("senior_center_groups");
    if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) _initialStoredGroups = parsed;
    }
} catch (e) {}

let _initialStoredReps = [];
try {
    const raw = localStorage.getItem("senior_center_sales_reps");
    if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) _initialStoredReps = parsed;
    }
} catch (e) {}

const state = {
    places: _initialStoredPlaces,
    groups: _initialStoredGroups,
    salesReps: _initialStoredReps,
    customStatuses: JSON.parse(localStorage.getItem("senior_center_custom_statuses")) || [...DEFAULT_STATUSES],
    activeGroup: "",
    activeFilter: "all",
    activeSalesRep: "all",
    isMaster: sessionStorage.getItem("is_master") === "true",
    masterPin: localStorage.getItem("master_pin") || "1234",
    searchKeyword: "",
    selectedPlaceId: null,
    pinDisplayMode: "number",
    kakaoJsKey: localStorage.getItem("kakao_js_key") || "82823b59e8640ba8b58e403c7463064a",
    lastSavedTimestamp: parseInt(localStorage.getItem("senior_center_last_saved") || "0", 10),
    activeMapEngine: "kakao", // "kakao" or "leaflet"
    kakaoMap: null,
    leafletMap: null,
    kakaoOverlays: [],
    kakaoInfoWindows: [],
    leafletMarkers: {},
    leafletTileLayer: null,
    myLocation: null,
    myLocationMarker: null
};

// Hadong Sample Senior Center Data (30 places)
const HADONG_SAMPLE_DATA = [
    { name: "고서경로당", address: "하동읍 고서길 74-4" },
    { name: "남당경로당", address: "하동읍 남당길 42-5" },
    { name: "서해량경로당", address: "하동읍 마방길 13-2" },
    { name: "두곡경로당", address: "하동읍 산북1길 8" },
    { name: "목압경로당", address: "화개면 목압길 32" },
    { name: "석문경로당", address: "화개면 차시배지길 12-2" },
    { name: "정동경로당", address: "악양면 정동상신길 24" },
    { name: "노전경로당", address: "악양면 노전길 59" },
    { name: "신촌경로당", address: "적량면 적량로 64" },
    { name: "동점경로당", address: "적량면 삼화실로 818" },
    { name: "중앙경로당", address: "횡천면 횡천강변길 23" },
    { name: "마치경로당", address: "횡천면 마치길 17" },
    { name: "사막경로당", address: "고전면 공설운동장로 383-1" },
    { name: "월진경로당", address: "고전면 전도리 736-1" },
    { name: "미법경로당", address: "금남면 미법마을길 134-4" },
    { name: "삼삼천경로당", address: "금남면 큰삼내길 34-3" },
    { name: "청도경로당", address: "금성면 내도청도길 146" },
    { name: "신도경로당", address: "금성면 신도길 69" },
    { name: "하평경로당", address: "진교면 민다리길 23-7" },
    { name: "이곡경로당", address: "진교면 이곡길 132" },
    { name: "고내경로당", address: "진교면 고이길 189" },
    { name: "윤산경로당", address: "하동군 양보면 윤산길 40" },
    { name: "원양샘골경로당", address: "하동군 양보면 원양샘골길 47" },
    { name: "남포경로당", address: "북천면 남포정자길 10" },
    { name: "사평경로당", address: "북천면 배안골길 4" },
    { name: "원묵경로당", address: "청암면 삼신봉로 62-17" },
    { name: "노은동경로당", address: "청암면 금남길 478-2" },
    { name: "병천경로당", address: "옥종면 병천길 62" },
    { name: "불무경로당", address: "옥종면 불무길 105" },
    { name: "한계경로당", address: "옥종면 한골길 80" }
];

const HADONG_GEO_MAP = {
    "고서경로당": { lat: 35.0682, lng: 127.7511, fullAddr: "경상남도 하동군 하동읍 고서길 74-4" },
    "남당경로당": { lat: 35.0715, lng: 127.7485, fullAddr: "경상남도 하동군 하동읍 남당길 42-5" },
    "서해량경로당": { lat: 35.0641, lng: 127.7554, fullAddr: "경상남도 하동군 하동읍 마방길 13-2" },
    "두곡경로당": { lat: 35.0789, lng: 127.7612, fullAddr: "경상남도 하동군 하동읍 산북1길 8" },
    "목압경로당": { lat: 35.1865, lng: 127.6321, fullAddr: "경상남도 하동군 화개면 목압길 32" },
    "석문경로당": { lat: 35.1742, lng: 127.6258, fullAddr: "경상남도 하동군 화개면 차시배지길 12-2" },
    "정동경로당": { lat: 35.1325, lng: 127.7124, fullAddr: "경상남도 하동군 악양면 정동상신길 24" },
    "노전경로당": { lat: 35.1481, lng: 127.7052, fullAddr: "경상남도 하동군 악양면 노전길 59" },
    "신촌경로당": { lat: 35.0921, lng: 127.7841, fullAddr: "경상남도 하동군 적량면 적량로 64" },
    "동점경로당": { lat: 35.1154, lng: 127.8123, fullAddr: "경상남도 하동군 적량면 삼화실로 818" },
    "중앙경로당": { lat: 35.0845, lng: 127.8256, fullAddr: "경상남도 하동군 횡천면 횡천강변길 23" },
    "마치경로당": { lat: 35.0912, lng: 127.8398, fullAddr: "경상남도 하동군 횡천면 마치길 17" },
    "사막경로당": { lat: 35.0125, lng: 127.7945, fullAddr: "경상남도 하동군 고전면 공설운동장로 383-1" },
    "월진경로당": { lat: 34.9958, lng: 127.8112, fullAddr: "경상남도 하동군 고전면 전도리 736-1" },
    "미법경로당": { lat: 34.9621, lng: 127.8245, fullAddr: "경상남도 하동군 금남면 미법마을길 134-4" },
    "삼삼천경로당": { lat: 34.9785, lng: 127.8391, fullAddr: "경상남도 하동군 금남면 큰삼내길 34-3" },
    "청도경로당": { lat: 34.9352, lng: 127.8012, fullAddr: "경상남도 하동군 금성면 내도청도길 146" },
    "신도경로당": { lat: 34.9412, lng: 127.8125, fullAddr: "경상남도 하동군 금성면 신도길 69" },
    "하평경로당": { lat: 35.0185, lng: 127.8941, fullAddr: "경상남도 하동군 진교면 민다리길 23-7" },
    "이곡경로당": { lat: 35.0312, lng: 127.8825, fullAddr: "경상남도 하동군 진교면 이곡길 132" },
    "고내경로당": { lat: 35.0248, lng: 127.8712, fullAddr: "경상남도 하동군 진교면 고이길 189" },
    "윤산경로당": { lat: 35.0458, lng: 127.8412, fullAddr: "경상남도 하동군 양보면 윤산길 40" },
    "원양샘골경로당": { lat: 35.0521, lng: 127.8523, fullAddr: "경상남도 하동군 양보면 원양샘골길 47" },
    "남포경로당": { lat: 35.1025, lng: 127.9124, fullAddr: "경상남도 하동군 북천면 남포정자길 10" },
    "사평경로당": { lat: 35.1158, lng: 127.9256, fullAddr: "경상남도 하동군 북천면 배안골길 4" },
    "원묵경로당": { lat: 35.1785, lng: 127.8741, fullAddr: "경상남도 하동군 청암면 삼신봉로 62-17" },
    "노은동경로당": { lat: 35.1621, lng: 127.8612, fullAddr: "경상남도 하동군 청암면 금남길 478-2" },
    "병천경로당": { lat: 35.1845, lng: 127.9612, fullAddr: "경상남도 하동군 옥종면 병천길 62" },
    "불무경로당": { lat: 35.1912, lng: 127.9745, fullAddr: "경상남도 하동군 옥종면 불무길 105" },
    "한계경로당": { lat: 35.2045, lng: 127.9821, fullAddr: "경상남도 하동군 옥종면 한골길 80" }
};

function isHeaderRow(name, address) {
    const cleanName = String(name || "").trim().toLowerCase();
    const cleanAddr = String(address || "").trim().toLowerCase();

    const headerKeywords = [
        "경로당명", "경로당 명", "경로당이름", "경로당 명칭",
        "주소", "도로명주소", "지번주소", "구분", "순번", "번호", "이름"
    ];

    return headerKeywords.includes(cleanName) || headerKeywords.includes(cleanAddr);
}

/**
 * Deduplicate places array by (name + address).
 * Excludes duplicate entries with identical normalized name and address.
 */
function deduplicatePlaces(placesList) {
    if (!Array.isArray(placesList)) return [];
    const seen = new Set();
    const deduplicated = [];

    for (const p of placesList) {
        if (!p) continue;
        if (isHeaderRow(p.name, p.address)) continue;

        const normName = String(p.name || "").trim().replace(/\s+/g, "");
        const normAddr = String(p.address || "").trim().replace(/\s+/g, "");

        if (!normName && !normAddr) continue;

        const normGroup = String(p.group || "").trim().replace(/\s+/g, "");
        const key = `${normGroup}|${normName}|${normAddr}`.toLowerCase();

        if (seen.has(key)) {
            continue; // Exclude duplicate
        }

        seen.add(key);
        deduplicated.push(p);
    }
    return deduplicated;
}

function sanitizeName(name, address) {
    if (!name) return "경로당";

    let clean = String(name)
        .replace(/[\uFFFD\uFEFF\u00A0]/g, "")
        .replace(/\?\?/g, "")
        .replace(/^[^\w가-힣]+/, "")
        .trim();

    if ((address && address.includes("중원로74번길")) || clean === "천부녀" || clean.endsWith("천부녀")) {
        return "화천부녀";
    }

    if (!clean || /^[^a-zA-Z0-9가-힣]+$/.test(clean)) {
        if (address) {
            const match = address.match(/([가-힣]+[동|리|면|읍])/);
            if (match) {
                return `${match[1]} 경로당`;
            }
        }
        return "경로당";
    }

    return clean;
}

function getTmapNavUrl(place) {
    if (!place) return "tmap://";
    const displayName = sanitizeName(place.name, place.address);
    const goalName = displayName || place.address || "목적지";
    if (place.lat && place.lng && !isNaN(place.lat) && !isNaN(place.lng)) {
        return `tmap://route?goalname=${encodeURIComponent(goalName)}&goalx=${place.lng}&goaly=${place.lat}`;
    }
    const query = place.address || displayName;
    return `tmap://search?name=${encodeURIComponent(query)}`;
}

const CHANGWON_EXCEL_CONTACTS = {
    "판신": [{ role: "회장", phone: "010-5663-7152" }, { role: "총무", phone: "010-4556-8924" }],
    "모암": [{ role: "회장", phone: "010-4593-9075" }, { role: "총무", phone: "010-2083-3551" }],
    "덕천": [{ role: "회장", phone: "010-4516-4713" }, { role: "총무", phone: "010-9519-2894" }],
    "용강": [{ role: "회장", phone: "010-9314-0781" }, { role: "총무", phone: "010-3521-4020" }],
    "힐스테이트3차": [{ role: "회장", phone: "010-4750-3317" }, { role: "총무", phone: "010-2951-3208" }],
    "조소": [{ role: "회장", phone: "010-6876-8118" }],
    "초소": [{ role: "회장", phone: "010-6876-8118" }],
    "승산": [{ role: "회장", phone: "010-3151-5768" }, { role: "총무", phone: "010-8622-4326" }],
    "북면stx kan": [{ role: "회장", phone: "010-7597-1219" }, { role: "총무", phone: "010-5588-8497" }],
    "신성": [{ role: "회장", phone: "010-8502-5653" }, { role: "총무", phone: "010-3564-4660" }],
    "화천부녀": [{ role: "회장", phone: "010-8502-5653" }, { role: "총무", phone: "010-3564-4660" }],
    "신전": [{ role: "회장", phone: "010-8518-2546" }, { role: "총무", phone: "010-3566-4969" }],
    "중포": [{ role: "회장", phone: "010-2547-5918" }, { role: "총무", phone: "010-9220-5551" }],
    "대방": [{ role: "회장", phone: "010-2587-5495" }, { role: "총무", phone: "010-8975-6038" }],
    "남모산": [{ role: "회장", phone: "010-4855-5376" }, { role: "총무", phone: "010-4875-4133" }],
    "강무": [{ role: "회장", phone: "010-2590-9485" }, { role: "총무", phone: "010-5529-2272" }],
    "유니시티3단지": [{ role: "회장", phone: "010-3870-3094" }, { role: "총무", phone: "010-2363-4040" }],
    "유니시티1단지": [{ role: "회장", phone: "010-3835-1299" }, { role: "총무", phone: "010-4588-0885" }],
    "원흥벽산B": [{ role: "회장", phone: "010-3575-2544" }, { role: "총무", phone: "010-5581-7086" }],
    "원풍벽산B": [{ role: "회장", phone: "010-3575-2544" }, { role: "총무", phone: "010-5581-7086" }],
    "팔용제2": [{ role: "회장", phone: "010-4567-3376" }, { role: "총무", phone: "010-4614-9512" }],
    "명서주민복지회관": [{ role: "회장", phone: "010-9345-2854" }, { role: "총무", phone: "010-8148-8338" }],
    "두산위브": [{ role: "회장", phone: "010-3571-5136" }, { role: "총무", phone: "010-7527-2565" }],
    "사림제1": [{ role: "회장", phone: "010-7291-3223" }, { role: "총무", phone: "010-9246-1122" }],
    "봉덕": [{ role: "회장", phone: "010-3595-4606" }, { role: "총무", phone: "010-3849-8005" }],
    "반지제1": [{ role: "회장", phone: "010-3188-9282" }, { role: "총무", phone: "010-4749-9023" }],
    "노블파크": [{ role: "회장", phone: "010-5689-7801" }, { role: "총무", phone: "010-4854-2962" }],
    "럭키반림": [{ role: "회장", phone: "010-5694-2742" }],
    "반지제4": [{ role: "회장", phone: "010-4581-1153" }, { role: "총무", phone: "010-8521-6668" }],
    "반지제3": [{ role: "회장", phone: "010-2181-9330" }],
    "중앙제1": [{ role: "회장", phone: "010-4576-6140" }],
    "대원파크빌": [{ role: "회장", phone: "010-3438-2889" }, { role: "총무", phone: "010-3433-9882" }],
    "용지": [{ role: "회장", phone: "010-3201-9822" }, { role: "총무", phone: "010-3080-5649" }],
    "용호": [{ role: "회장", phone: "010-9677-3388" }, { role: "총무", phone: "010-9025-7514" }],
    "상남": [{ role: "회장", phone: "010-7199-5748" }, { role: "총무", phone: "010-4071-1412" }],
    "사파정": [{ role: "회장", phone: "010-6877-6673" }, { role: "총무", phone: "010-9396-9275" }],
    "신덕": [{ role: "회장", phone: "010-9250-2698" }, { role: "총무", phone: "010-9338-8633" }]
};

function getPlaceContacts(place) {
    if (place && Array.isArray(place.contacts)) {
        return place.contacts.filter(c => c && c.phone && c.phone !== "--" && c.phone !== "-");
    }
    return [];
}

function extractContactFromAny(item, defaultRole = "") {
    if (!item) return null;
    let fullStr = "";
    let objRole = "";

    if (typeof item === "string") {
        fullStr = item;
    } else if (typeof item === "object") {
        objRole = item.role || item.title || "";
        fullStr = Object.values(item).filter(v => typeof v === "string" || typeof v === "number").join(" ");
    } else {
        fullStr = String(item);
    }

    const cleanStr = fullStr.trim();
    if (!cleanStr || cleanStr.includes("없음") || cleanStr === "-" || cleanStr === "0") return null;

    let digits = "";
    const match = cleanStr.match(/(0\d{8,10})|(0\d{1,2}[-\s\.]?\d{3,4}[-\s\.]?\d{4})|(\d{3,4}[-\s\.]?\d{4})/);
    if (match) {
        digits = match[0].replace(/[^0-9]/g, "");
    } else {
        digits = cleanStr.replace(/[^0-9]/g, "");
    }

    if (digits.length < 9 || digits.length > 11) return null;

    let formattedPhone = digits;
    if (digits.startsWith("02")) {
        if (digits.length === 9) formattedPhone = digits.replace(/^(\d{2})(\d{3})(\d{4})$/, "$1-$2-$3");
        else if (digits.length === 10) formattedPhone = digits.replace(/^(\d{2})(\d{4})(\d{4})$/, "$1-$2-$3");
    } else if (digits.length === 10) {
        formattedPhone = digits.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3");
    } else if (digits.length === 11) {
        formattedPhone = digits.replace(/^(\d{3})(\d{4})(\d{4})$/, "$1-$2-$3");
    }

    let role = "";
    if (/이장/.test(cleanStr)) role = "이장";
    else if (/부회장/.test(cleanStr)) role = "부회장";
    else if (/회장/.test(cleanStr)) role = "회장";
    else if (/총무/.test(cleanStr)) role = "총무";
    else if (/부녀/.test(cleanStr)) role = "부녀회장";
    else if (objRole && !/[가-힣]{2,4}\s*회장/.test(objRole)) {
        role = String(objRole).replace(/[\(\)\[\]:]/g, "").trim();
    }

    if (!role || (/[가-힣]{2,4}/.test(role) && !/이장|회장|총무|부회장|부녀회장/.test(role))) {
        role = defaultRole || "연락처";
    }

    const cleanRole = role.replace(/[\(\)\[\]:]/g, "").trim();

    return {
        role: cleanRole,
        phone: formattedPhone
    };
}

function parseContactString(str, defaultRole = "") {
    return extractContactFromAny(str, defaultRole);
}

function renderContactsHtml(contacts, isPopup = false) {
    let list = [];
    if (Array.isArray(contacts)) {
        list = contacts;
    } else if (typeof contacts === "object" || typeof contacts === "string") {
        list = [contacts];
    }

    const validContacts = [];
    if (list.length > 0) {
        list.forEach((item) => {
            const parsed = extractContactFromAny(item, "");
            if (parsed && parsed.phone) {
                validContacts.push(parsed);
            }
        });
    }

    if (validContacts.length === 0) return "";

    let html = `<div class="contacts-box" style="margin:${isPopup ? '10px 0' : '8px 0'}; padding:10px 12px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; font-size:12px;">`;
    validContacts.forEach((c, idx) => {
        const rolePart = c.role ? `${escapeHtml(c.role)} ` : '연락처 ';
        const phonePart = escapeHtml(c.phone);
        const telUrl = `tel:${phonePart.replace(/[^0-9]/g, '')}`;
        const borderStyle = idx < validContacts.length - 1 ? 'border-bottom:1px dashed #cbd5e1; padding-bottom:8px; margin-bottom:8px;' : 'padding-top:2px;';

        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; ${borderStyle}">
                <span style="font-weight:600; color:#1e293b; font-size:12px; display:inline-flex; align-items:center; gap:4px;">
                    <i class="fa-solid fa-phone-volume" style="color:#64748b; font-size:11px;"></i> ${rolePart}${phonePart}
                </span>
                <a href="${telUrl}" class="btn-tel-call" style="background:#03cf5d; color:white; padding:4px 10px; border-radius:5px; font-size:11px; font-weight:700; text-decoration:none; white-space:nowrap; display:inline-flex; align-items:center; gap:4px; box-shadow:0 1px 3px rgba(0,0,0,0.12);">
                    <i class="fa-solid fa-phone"></i> 전화걸기
                </a>
            </div>
        `;
    });
    html += `</div>`;
    return html;
}

function loadKakaoSdk(appKey) {
    return new Promise((resolve, reject) => {
        if (!appKey || !appKey.trim()) {
            reject(new Error("No Kakao App Key provided"));
            return;
        }
        const cleanKey = appKey.trim();

        if (window.kakao && window.kakao.maps && window.kakao.maps.Map && window.kakao.__loadedKey === cleanKey) {
            resolve();
            return;
        }

        const existingScript = document.getElementById("kakao-sdk-script");
        if (existingScript) existingScript.remove();

        const script = document.createElement("script");
        script.id = "kakao-sdk-script";
        script.type = "text/javascript";
        script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${cleanKey}&libraries=services`;
        
        script.onload = () => {
            if (window.kakao && window.kakao.maps && window.kakao.maps.Map) {
                window.kakao.__loadedKey = cleanKey;
                resolve();
            } else if (window.kakao && window.kakao.maps && typeof kakao.maps.load === "function") {
                kakao.maps.load(() => {
                    window.kakao.__loadedKey = cleanKey;
                    resolve();
                });
            } else {
                reject(new Error("카카오 스크립트는 읽어왔으나 kakao.maps 객체가 정의되지 않았습니다.\n(카카오 디벨로퍼스 -> [제품 설정] -> [카카오맵] 활성화 설정이 OFF인 경우 발생합니다)"));
            }
        };
        script.onerror = () => reject(new Error("Failed to load Kakao SDK script"));
        document.head.appendChild(script);
    });
}

// Application Initialization
document.addEventListener("DOMContentLoaded", async () => {
    await initData();
    initUIEvents();

    // Fetch shared Kakao JS key from server to sync across PC and mobile
    try {
        const configResp = await fetch('/api/config');
        if (configResp.ok) {
            const configData = await configResp.json();
            if (configData && configData.kakaoJsKey) {
                state.kakaoJsKey = configData.kakaoJsKey;
                localStorage.setItem("kakao_js_key", configData.kakaoJsKey);
            }
        }
    } catch (e) {
        console.warn("Could not fetch server config:", e);
    }

    renderGroupSelect();

    // If opened via file:// scheme, notify user to use http://localhost:8080 for Kakao Maps
    if (window.location.protocol === "file:") {
        const topNotice = document.createElement("div");
        topNotice.style.cssText = "background:#ffecb3; color:#795548; padding:8px 16px; font-size:13px; font-weight:600; text-align:center; border-bottom:1px solid #ffe082; z-index:9999; display:flex; justify-content:center; align-items:center; gap:10px;";
        topNotice.innerHTML = `
            <span>⚠️ 현재 파일 직접 열기(file://) 모드입니다. 지도를 100% 카카오 순정 지도로 이용하시려면 <b>바탕화면의 [경로당_지도_관리자_실행.bat]</b>을 더블클릭 하거나 아래 버튼을 누르세요.</span>
            <a href="http://localhost:8080" style="background:#03cf5d; color:white; padding:4px 10px; border-radius:4px; text-decoration:none; font-size:12px; font-weight:700;">🌐 http://localhost:8080 로 이동</a>
        `;
        document.body.prepend(topNotice);

        initLeafletMap();
        state.activeMapEngine = "leaflet";
        updateEngineButtonUI();
        renderPlaceList();
        return;
    }

    let loadedKakao = false;
    if (state.kakaoJsKey) {
        try {
            await loadKakaoSdk(state.kakaoJsKey);
            initKakaoMap();
            state.activeMapEngine = "kakao";
            loadedKakao = true;
        } catch (e) {
            console.warn("Kakao SDK load failed, falling back to clean map:", e);
        }
    }

    if (!loadedKakao) {
        initLeafletMap();
        state.activeMapEngine = "leaflet";
    }

    updateEngineButtonUI();
    renderPlaceList();
});

/* ----------------------------------------------------
   IndexedDB & Multi-Layer Permanent Storage
---------------------------------------------------- */
const SENIOR_DB_NAME = "SeniorCenterMapPermanentDB";
const SENIOR_DB_VERSION = 1;
const STORE_DATA = "AppData";
const STORE_SNAPSHOTS = "Snapshots";

function openSeniorDb() {
    return new Promise((resolve) => {
        if (!window.indexedDB) return resolve(null);
        try {
            const req = indexedDB.open(SENIOR_DB_NAME, SENIOR_DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_DATA)) {
                    db.createObjectStore(STORE_DATA, { keyPath: "key" });
                }
                if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
                    db.createObjectStore(STORE_SNAPSHOTS, { keyPath: "id", autoIncrement: true });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        } catch (e) {
            resolve(null);
        }
    });
}

async function saveToIndexedDb(data) {
    const db = await openSeniorDb();
    if (!db) return false;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction([STORE_DATA], "readwrite");
            const store = tx.objectStore(STORE_DATA);
            store.put({ key: "main_data", ...data });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        } catch (e) {
            resolve(false);
        }
    });
}

async function loadFromIndexedDb() {
    const db = await openSeniorDb();
    if (!db) return null;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction([STORE_DATA], "readonly");
            const store = tx.objectStore(STORE_DATA);
            const req = store.get("main_data");
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        } catch (e) {
            resolve(null);
        }
    });
}

async function createAutoSnapshot(places, groups) {
    if (!places || places.length === 0) return;
    const db = await openSeniorDb();
    if (!db) return;
    try {
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const snapshot = {
            dateStr,
            timestamp: Date.now(),
            count: places.length,
            groups: [...groups],
            places: places
        };
        const tx = db.transaction([STORE_SNAPSHOTS], "readwrite");
        const store = tx.objectStore(STORE_SNAPSHOTS);
        store.add(snapshot);
        // Retain last 10 snapshots max
        const countReq = store.count();
        countReq.onsuccess = () => {
            if (countReq.result > 10) {
                const cur = store.openCursor();
                cur.onsuccess = (ev) => {
                    const c = ev.target.result;
                    if (c && countReq.result > 10) {
                        c.delete();
                    }
                };
            }
        };
    } catch (e) {}
}

async function getAutoSnapshots() {
    const db = await openSeniorDb();
    if (!db) return [];
    return new Promise((resolve) => {
        try {
            const tx = db.transaction([STORE_SNAPSHOTS], "readonly");
            const store = tx.objectStore(STORE_SNAPSHOTS);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        } catch (e) {
            resolve([]);
        }
    });
}

const CURRENT_DATA_VERSION = "2026-09-28-bulletproof-v2";

function checkAndMigrateStorage() {
    try {
        localStorage.setItem("senior_center_data_version", CURRENT_DATA_VERSION);
    } catch (e) {}
}

async function initData() {
    checkAndMigrateStorage();

    // 1. ALWAYS initialize from LocalStorage and IndexedDB first (Zero-delay offline guarantee)
    await initLocalAndIndexedDbStorage();

    // 2. Fetch server config (shared Kakao JS Key)
    try {
        const configResp = await fetch('/api/config');
        if (configResp.ok) {
            const configData = await configResp.json();
            if (configData && configData.kakaoJsKey) {
                state.kakaoJsKey = configData.kakaoJsKey;
                localStorage.setItem("kakao_js_key", configData.kakaoJsKey);
            }
        }
    } catch (e) {
        console.warn("Could not fetch server config:", e);
    }

    // 3. Sync from server (with anti-wipe safety shield)
    await syncDataFromServer();

    if (state.kakaoJsKey) {
        const keyInput = document.getElementById("input-kakao-js-key");
        if (keyInput) keyInput.value = state.kakaoJsKey;
    }

    // Auto-sync polling every 3 seconds for mobile <-> PC sync
    setInterval(syncDataFromServer, 3000);
}

let lastKnownServerUpdateId = null;
try {
    lastKnownServerUpdateId = sessionStorage.getItem("last_known_server_update_id") || null;
} catch (e) {}

async function syncDataFromServer() {
    try {
        const resp = await fetch(`/api/data?_t=${Date.now()}`, {
            cache: 'no-store',
            headers: {
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
        if (resp.ok) {
            const data = await resp.json();
            if (data && Array.isArray(data.places) && Array.isArray(data.groups)) {
                if (data.updateId) {
                    lastKnownServerUpdateId = data.updateId;
                    try {
                        sessionStorage.setItem("last_known_server_update_id", data.updateId);
                    } catch (e) {}
                }

                // If user just saved locally within the last 3 seconds, wait for post to settle
                if (state.isImportingOrSaving || Date.now() - (state.lastSavedTimestamp || 0) < 5000) {
                    return true;
                }

                const cleanCurrentPlaces = getCleanPlaces(state.places);

                // 🛡️ CRITICAL SHIELD: If client has registered places but server returned 0 places
                // (e.g. Vercel serverless container rebooted overnight), NEVER wipe client!
                // Immediately push client's data back to server so the serverless RAM is restored!
                if (cleanCurrentPlaces.length > 0 && data.places.length === 0) {
                    console.warn(`[자동 복구] 서버 컨테이너가 재부팅되어 빈 데이터가 수신되었습니다. 로컬에 안전하게 보관된 ${cleanCurrentPlaces.length}개의 경로당 데이터를 서버로 즉시 복원합니다.`);
                    await saveState("auto-restore");
                    return true;
                }

                // If server has places (>0):
                if (data.places.length > 0) {
                    const serverTimestamp = data.timestamp || 0;
                    const localTimestamp = state.lastSavedTimestamp || 0;

                    // If server data is newer or local is empty, update local from server
                    if (cleanCurrentPlaces.length === 0 || serverTimestamp >= localTimestamp) {
                        const prevPlaces = JSON.stringify(cleanCurrentPlaces);
                        const newPlaces = JSON.stringify(data.places);
                        const prevGroups = JSON.stringify(state.groups);
                        const newGroups = JSON.stringify(data.groups);

                        if (prevPlaces !== newPlaces || prevGroups !== newGroups) {
                            state.places = data.places.map(p => {
                                if (p) p.status = normalizePlaceStatus(p.status);
                                return p;
                            });
                            state.groups = data.groups;

                            saveToLocalStorageAndIndexedDb();

                            if (state.activeGroup && !state.groups.includes(state.activeGroup)) {
                                state.activeGroup = "";
                            }

                            renderGroupSelect();
                            renderSalesRepSelects();
                            renderStatusSummaryChips();
                            renderPlaceList();
                        }
                    } else if (localTimestamp > serverTimestamp && cleanCurrentPlaces.length > 0) {
                        // Local is newer than server, push local to server
                        await saveState("client-sync");
                    }
                }

                // Sync custom statuses from server if modal is not currently open
                const modalStatusSettingEl = document.getElementById("modal-status-setting");
                const isModalOpen = modalStatusSettingEl && modalStatusSettingEl.style.display === "flex";
                if (!isModalOpen && Array.isArray(data.customStatuses) && data.customStatuses.length > 0) {
                    const serverStatusesJson = JSON.stringify(data.customStatuses);
                    const localStatusesJson = JSON.stringify(state.customStatuses);
                    if (serverStatusesJson !== localStatusesJson) {
                        state.customStatuses = data.customStatuses;
                        localStorage.setItem("senior_center_custom_statuses", serverStatusesJson);
                        renderStatusSummaryChips();
                        renderPlaceListUIOnly();
                    }
                }

                // Sync sales reps if different
                if (Array.isArray(data.salesReps)) {
                    const serverRepsJson = JSON.stringify(data.salesReps);
                    const localRepsJson = JSON.stringify(state.salesReps);
                    if (serverRepsJson !== localRepsJson) {
                        state.salesReps = data.salesReps;
                        localStorage.setItem("senior_center_sales_reps", serverRepsJson);
                        renderSalesRepSelects();
                    }
                }
                return true;
            }
        }
    } catch (e) {}
    return false;
}

async function initLocalAndIndexedDbStorage() {
    initLocalStorage();

    // If localStorage was empty, restore from IndexedDB
    if (state.places.length === 0) {
        try {
            const dbData = await loadFromIndexedDb();
            if (dbData && Array.isArray(dbData.places) && dbData.places.length > 0) {
                console.log(`[영구보관] IndexedDB에서 ${dbData.places.length}개의 경로당 데이터를 복원했습니다.`);
                state.places = deduplicatePlaces(dbData.places).map(p => {
                    if (p) p.status = normalizePlaceStatus(p.status);
                    return p;
                });
                if (Array.isArray(dbData.groups) && dbData.groups.length > 0) {
                    state.groups = dbData.groups;
                }
                if (Array.isArray(dbData.salesReps)) {
                    state.salesReps = dbData.salesReps;
                }
                if (Array.isArray(dbData.customStatuses) && dbData.customStatuses.length > 0) {
                    state.customStatuses = dbData.customStatuses;
                }
                state.lastSavedTimestamp = dbData.timestamp || Date.now();

                saveToLocalStorageAndIndexedDb();
            }
        } catch (e) {
            console.warn("IndexedDB load error:", e);
        }
    }
}

function initLocalStorage() {
    // 1. Load Saved Groups
    const storedGroups = localStorage.getItem("senior_center_groups");
    if (storedGroups) {
        try {
            state.groups = JSON.parse(storedGroups);
        } catch (e) {
            state.groups = [];
        }
    } else {
        state.groups = [];
    }

    // 2. Load Saved Sales Reps
    const storedReps = localStorage.getItem("senior_center_sales_reps");
    if (storedReps) {
        try {
            state.salesReps = JSON.parse(storedReps);
        } catch (e) {
            state.salesReps = [];
        }
    }

    // 3. Load Saved Custom Statuses
    const storedStatuses = localStorage.getItem("senior_center_custom_statuses");
    if (storedStatuses) {
        try {
            const parsed = JSON.parse(storedStatuses);
            if (parsed.some(s => s.id === "unselected" || s.id === "verified")) {
                state.customStatuses = [...DEFAULT_STATUSES];
            } else {
                state.customStatuses = parsed;
            }
        } catch (e) {
            state.customStatuses = [...DEFAULT_STATUSES];
        }
    } else {
        state.customStatuses = [...DEFAULT_STATUSES];
    }

    // 4. Load Saved Places
    const storedPlaces = localStorage.getItem("senior_center_places");
    if (storedPlaces) {
        try {
            const parsed = JSON.parse(storedPlaces);
            const deduped = deduplicatePlaces(parsed);
            state.places = deduped.map(p => {
                if (p) p.status = normalizePlaceStatus(p.status);
                return p;
            });
        } catch (e) {
            state.places = [];
        }
    } else {
        state.places = [];
    }

    if (!state.activeGroup || !state.groups.includes(state.activeGroup)) {
        state.activeGroup = "";
    }

    if (state.kakaoJsKey) {
        const keyInput = document.getElementById("input-kakao-js-key");
        if (keyInput) keyInput.value = state.kakaoJsKey;
    }
}

function saveToLocalStorageAndIndexedDb() {
    const cleanPlaces = getCleanPlaces(state.places);
    try {
        localStorage.setItem("senior_center_places", JSON.stringify(cleanPlaces));
        localStorage.setItem("senior_center_groups", JSON.stringify(state.groups));
        localStorage.setItem("senior_center_sales_reps", JSON.stringify(state.salesReps));
        localStorage.setItem("senior_center_custom_statuses", JSON.stringify(state.customStatuses));
        localStorage.setItem("senior_center_last_saved", String(state.lastSavedTimestamp || Date.now()));
    } catch (e) {}

    saveToIndexedDb({
        places: cleanPlaces,
        groups: state.groups,
        salesReps: state.salesReps,
        customStatuses: state.customStatuses,
        timestamp: state.lastSavedTimestamp || Date.now()
    }).catch(() => {});
}

function getCleanPlaces(places) {
    if (!Array.isArray(places)) return [];
    return places.map(p => {
        if (!p) return null;
        // Clean out runtime circular DOM / Map SDK references
        const {
            _kakaoOverlayContent,
            _kakaoPopup,
            _kakaoPopupEl,
            _kakaoCluster,
            ...clean
        } = p;
        return clean;
    }).filter(Boolean);
}

async function saveState(savedBy = null) {
    state.lastSavedTimestamp = Date.now();
    const sourceDevice = savedBy || (isMobileDevice() ? "mobile" : "web");

    const cleanPlaces = getCleanPlaces(state.places);
    const placesJson = JSON.stringify(cleanPlaces);
    const groupsJson = JSON.stringify(state.groups);
    const salesRepsJson = JSON.stringify(state.salesReps);
    const customStatusesJson = JSON.stringify(state.customStatuses);

    // 1. Permanent LocalStorage
    try {
        localStorage.setItem("senior_center_places", placesJson);
        localStorage.setItem("senior_center_groups", groupsJson);
        localStorage.setItem("senior_center_sales_reps", salesRepsJson);
        localStorage.setItem("senior_center_custom_statuses", customStatusesJson);
        localStorage.setItem("senior_center_last_saved", String(state.lastSavedTimestamp));
    } catch (e) {
        console.warn("LocalStorage save warning:", e);
    }

    // 2. Permanent IndexedDB (No quota limitations)
    try {
        await saveToIndexedDb({
            places: cleanPlaces,
            groups: state.groups,
            salesReps: state.salesReps,
            customStatuses: state.customStatuses,
            timestamp: state.lastSavedTimestamp
        });
    } catch (e) {
        console.warn("IndexedDB save error:", e);
    }

    // 3. Retain Auto-Backup Snapshot (if places > 0)
    if (cleanPlaces.length > 0) {
        try {
            await createAutoSnapshot(cleanPlaces, state.groups);
        } catch (e) {}
    }

    // 4. Server Sync
    try {
        const resp = await fetch(`/api/data?_t=${Date.now()}`, {
            method: 'POST',
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/json',
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
            body: JSON.stringify({
                places: cleanPlaces,
                groups: state.groups,
                salesReps: state.salesReps,
                customStatuses: state.customStatuses,
                timestamp: state.lastSavedTimestamp,
                savedBy: sourceDevice
            })
        });
        state.lastSavedTimestamp = Date.now();
        if (!resp.ok) {
            console.warn(`서버 응답 오류 (${resp.status}) - 로컬 및 IndexedDB에는 안전하게 영구 저장되었습니다.`);
        }
    } catch (e) {
        console.warn("서버 통신 실패 (오프라인 모드) - 로컬 및 IndexedDB에는 정상 보관되었습니다:", e);
    }
}

/* ----------------------------------------------------
   1. Official Native Kakao Map Engine
---------------------------------------------------- */
function initKakaoMap() {
    document.getElementById("kakao-map").style.display = "block";
    document.getElementById("leaflet-map").style.display = "none";

    const container = document.getElementById("kakao-map");
    const defaultCenter = new kakao.maps.LatLng(35.0682, 127.7511);
    
    if (!state.kakaoMap) {
        const options = {
            center: defaultCenter,
            level: 8
        };
        state.kakaoMap = new kakao.maps.Map(container, options);

        // Native Kakao Map Controls (Zoom control only; MapTypeControl/Skyview removed as requested)
        const zoomControl = new kakao.maps.ZoomControl();
        state.kakaoMap.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);
        
        // Click background map to close all popups & deselect place
        kakao.maps.event.addListener(state.kakaoMap, "click", () => {
            state.kakaoInfoWindows.forEach(p => {
                if (p && p.setMap) p.setMap(null);
                else if (p && p.close) p.close();
            });
            if (state.selectedPlaceId !== null) {
                state.selectedPlaceId = null;
                renderPlaceListUIOnly();
            }
        });
    }

    setTimeout(() => {
        if (state.kakaoMap) {
            state.kakaoMap.relayout();
        }
    }, 120);
}

/**
 * Group places that share identical/near-identical location (lat, lng within 0.00015) or normalized address.
 */
function groupPlacesByLocation(places) {
    const clusters = [];
    const threshold = 0.00015; // ~15 meters

    places.forEach(place => {
        if (!place.lat || !place.lng) return;

        const normAddr = String(place.address || "").replace(/[\s\(\)\,\.\-]/g, "").toLowerCase();

        let matchedCluster = clusters.find(cl => {
            const latDiff = Math.abs(cl.lat - place.lat);
            const lngDiff = Math.abs(cl.lng - place.lng);
            const isCoordClose = latDiff < threshold && lngDiff < threshold;
            const isAddrSame = normAddr && cl.places.some(cp => {
                const cNorm = String(cp.address || "").replace(/[\s\(\)\,\.\-]/g, "").toLowerCase();
                return cNorm && (cNorm === normAddr || cNorm.includes(normAddr) || normAddr.includes(cNorm));
            });
            return isCoordClose || isAddrSame;
        });

        if (matchedCluster) {
            matchedCluster.places.push(place);
        } else {
            clusters.push({
                lat: place.lat,
                lng: place.lng,
                places: [place]
            });
        }
    });

    return clusters;
}

function buildPinBadgeHtml(clusterPlaces, groupPlaces) {
    const count = clusterPlaces.length;
    const firstPlace = clusterPlaces[0];
    const firstSeq = groupPlaces.indexOf(firstPlace) + 1;
    const firstStatusObj = getStatusObj(firstPlace.status);
    const firstDisplayName = sanitizeName(firstPlace.name, firstPlace.address);
    const isMulti = count > 1;
    const isNumberOnly = state.pinDisplayMode !== "number_name";

    if (isMulti) {
        const seqNums = clusterPlaces.map(p => {
            const s = groupPlaces.indexOf(p) + 1;
            return s > 0 ? s : "";
        }).filter(Boolean);
        const seqStr = seqNums.length > 0 ? seqNums.join(",") : "";
        const fullTitle = `${seqStr ? seqStr + '. ' : ''}${firstDisplayName} 외 ${count - 1}곳 (동일건물)`;

        if (isNumberOnly) {
            return `
                <div class="custom-pin-badge is-multi-building pin-mode-number" style="border-color: #2563eb;" title="${escapeHtml(fullTitle)}">
                    <span class="pin-number multi-building-icon">🏢</span>
                    <span class="pin-label" style="color:#1d4ed8; font-weight:800;">${escapeHtml(seqStr || (count + '곳'))}</span>
                </div>
            `;
        }
        return `
            <div class="custom-pin-badge is-multi-building" style="border-color: #2563eb;" title="${escapeHtml(fullTitle)}">
                <span class="pin-number multi-building-icon">🏢</span>
                <span class="pin-label" style="color:#1d4ed8; font-weight:800;">
                    ${seqStr ? `${seqStr}. ` : ''}${escapeHtml(firstDisplayName)} 외 ${count - 1}곳 (동일건물)
                </span>
            </div>
        `;
    } else {
        const displaySeq = firstSeq > 0 ? firstSeq : "•";
        const contrastColor = getContrastTextColor(firstStatusObj.color);
        const fullTitle = `${firstSeq > 0 ? firstSeq + '. ' : ''}${firstDisplayName}`;

        if (isNumberOnly) {
            return `
                <div class="custom-pin-badge pin-mode-number" style="border-color: ${firstStatusObj.color};" title="${escapeHtml(fullTitle)}">
                    <span class="pin-number" style="background: ${firstStatusObj.color}; color: ${contrastColor};">${displaySeq}</span>
                </div>
            `;
        }
        return `
            <div class="custom-pin-badge" style="border-color: ${firstStatusObj.color};" title="${escapeHtml(fullTitle)}">
                <span class="pin-number" style="background: ${firstStatusObj.color}; color: ${contrastColor};">${firstSeq > 0 ? firstSeq : ""}</span>
                <span class="pin-label">${escapeHtml(firstDisplayName)}</span>
            </div>
        `;
    }
}

function setPinDisplayMode(mode) {
    state.pinDisplayMode = mode === "number_name" ? "number_name" : "number";
    document.querySelectorAll(".pin-mode-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-pin-mode") === state.pinDisplayMode);
    });
    const filtered = getFilteredPlaces();
    if (state.activeMapEngine === "kakao" && state.kakaoMap) {
        renderKakaoMarkers(filtered, false);
    } else if (state.leafletMap) {
        renderLeafletMarkers(filtered, false);
    }
}

function renderKakaoMarkers(places = null, shouldFitBounds = false) {
    if (!state.kakaoMap) return;

    places = (Array.isArray(places) && places.length > 0) ? places : getFilteredPlaces();

    // Clear existing Kakao overlays and info windows
    state.kakaoOverlays.forEach(overlay => {
        if (overlay && overlay.setMap) overlay.setMap(null);
    });
    state.kakaoInfoWindows.forEach(info => {
        if (info && info.setMap) info.setMap(null);
        else if (info && info.close) info.close();
    });
    state.kakaoOverlays = [];
    state.kakaoInfoWindows = [];

    // Also close and clean any previously attached popup overlays on places
    state.places.forEach(p => {
        if (p._kakaoPopup && p._kakaoPopup.setMap) {
            p._kakaoPopup.setMap(null);
        }
        p._kakaoPopup = null;
        p._kakaoPopupEl = null;
        p._kakaoOverlayContent = null;
        p._kakaoCluster = null;
    });

    const bounds = new kakao.maps.LatLngBounds();
    let hasPoints = false;

    const groupPlaces = (!state.activeGroup ? [] : state.places.filter(p => p.group === state.activeGroup))
        .filter(p => !isHeaderRow(p.name, p.address));

    // Group places by same building / location
    const clusters = groupPlacesByLocation(places);

    clusters.forEach((cluster) => {
        const clusterPlaces = cluster.places;
        const count = clusterPlaces.length;
        const position = new kakao.maps.LatLng(cluster.lat, cluster.lng);
        bounds.extend(position);
        hasPoints = true;

        const firstPlace = clusterPlaces[0];
        const firstSeq = groupPlaces.indexOf(firstPlace) + 1;
        const firstStatusObj = getStatusObj(firstPlace.status);
        const firstDisplayName = sanitizeName(firstPlace.name, firstPlace.address);

        let pinHtml = "";
        const isMulti = count > 1;

        if (isMulti) {
            // Same building badge (e.g., 🏢 동일건물 (2)개 or 2, 3. 초연 외 1곳)
            const seqNums = clusterPlaces.map(p => {
                const s = groupPlaces.indexOf(p) + 1;
                return s > 0 ? s : "";
            }).filter(Boolean);
            const seqStr = seqNums.length > 0 ? seqNums.join(",") : "";

            pinHtml = `
                <div class="custom-pin-badge is-multi-building" style="border-color: #2563eb;">
                    <span class="pin-number multi-building-icon">🏢</span>
                    <span class="pin-label" style="color:#1d4ed8; font-weight:800;">
                        ${seqStr ? `${seqStr}. ` : ''}${escapeHtml(firstDisplayName)} 외 ${count - 1}곳 (동일건물)
                    </span>
                </div>
            `;
        } else {
            const displaySeq = firstSeq > 0 ? firstSeq : "";
            pinHtml = `
                <div class="custom-pin-badge" style="border-color: ${firstStatusObj.color};">
                    <span class="pin-number" style="background: ${firstStatusObj.color};">${displaySeq}</span>
                    <span class="pin-label">${escapeHtml(firstDisplayName)}</span>
                </div>
            `;
        }

        // Custom Overlay Pin Badge
        const content = document.createElement("div");
        content.className = "kakao-custom-overlay";
        content.innerHTML = buildPinBadgeHtml(clusterPlaces, groupPlaces);

        const baseZIndex = 100 + (1000 - firstSeq);
        const overlay = new kakao.maps.CustomOverlay({
            position: position,
            content: content,
            yAnchor: 1.2,
            zIndex: baseZIndex
        });
        overlay.setMap(state.kakaoMap);
        state.kakaoOverlays.push(overlay);

        // Hover z-index boost to instantly bring hovered pin to top
        content.addEventListener("mouseenter", () => {
            overlay.setZIndex(9999);
            content.style.zIndex = "9999";
        });
        content.addEventListener("mouseleave", () => {
            const isSel = clusterPlaces.some(p => p.id === state.selectedPlaceId);
            overlay.setZIndex(isSel ? 9998 : baseZIndex);
            content.style.zIndex = isSel ? "9998" : "";
        });

        // Build Popup Element (Single vs Multi-Building)
        const popupEl = document.createElement("div");
        popupEl.className = "kakao-popup-wrapper";

        if (isMulti) {
            // Multi-building popup (Simultaneous view of all centers in the building)
            let itemsHtml = "";
            clusterPlaces.forEach((p) => {
                const seq = groupPlaces.indexOf(p) + 1;
                const dSeq = seq > 0 ? `${seq}. ` : "";
                const dName = sanitizeName(p.name, p.address);
                const sObj = getStatusObj(p.status);
                const stOptions = renderStatusOptionsHtml(sObj.id);
                const cHtml = renderContactsHtml(getPlaceContacts(p), true, p.id);

                itemsHtml += `
                    <div class="multi-place-item" data-place-id="${p.id}">
                        <div class="multi-place-item-top">
                            <span class="multi-place-name" title="${escapeHtml(dName)}">
                                <span style="color:#2563eb; font-weight:800;">${dSeq}</span>👵 ${escapeHtml(dName)}
                            </span>
                            <div style="display:flex; align-items:center; gap:5px;">
                                <button type="button" class="popup-edit-btn" data-id="${p.id}" title="주소 및 정보 수정" aria-label="수정">
                                    <i class="fa-solid fa-pencil"></i>
                                </button>
                                <select class="popup-status-select multi-status-select" data-id="${p.id}" style="background:${sObj.color}; color:${getContrastTextColor(sObj.color)};">
                                    ${stOptions}
                                </select>
                            </div>
                        </div>
                        <div class="popup-address" style="font-size:11.5px; color:#64748b; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center; gap:4px;">
                            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(p.address)}">
                                <i class="fa-solid fa-location-dot" style="color:#ef4444;"></i> ${escapeHtml(p.address)}
                            </span>
                            <button type="button" class="popup-edit-btn popup-addr-edit-btn" data-id="${p.id}" title="주소 수정" aria-label="주소 수정">
                                <i class="fa-solid fa-pencil"></i>
                            </button>
                        </div>
                        ${cHtml}
                        <div class="popup-memo-box">
                            <div class="popup-memo-title">
                                <span><i class="fa-solid fa-note-sticky" style="color:#d97706;"></i> 특이사항 / 메모</span>
                                <span class="popup-memo-status-msg" data-memo-msg-for="${p.id}" style="font-size:11px; font-weight:700; color:#16a34a;"></span>
                            </div>
                            <textarea class="popup-memo-textarea" data-id="${p.id}" rows="2" placeholder="특이사항 / 방문메모 입력...">${escapeHtml(p.memo || "")}</textarea>
                        </div>
                    </div>
                `;
            });

            const naverNavUrl = getTmapNavUrl(firstPlace);
            const kakaoNavUrl = `https://map.kakao.com/link/search/${encodeURIComponent(firstPlace.address)}`;

            popupEl.innerHTML = `
                <div class="shadow-popup multi-building-card">
                    <div class="multi-building-header">
                        <span class="multi-building-header-title">
                            <i class="fa-solid fa-building"></i> 동일 건물 경로당 (${count}개)
                        </span>
                        <button class="popup-close-btn" style="color:#ffffff; font-size:20px;">&times;</button>
                    </div>
                    <div class="multi-place-list">
                        ${itemsHtml}
                    </div>
                    <div class="popup-actions" style="display:flex; gap:6px; margin-top:10px;">
                        <a href="${naverNavUrl}" class="popup-btn popup-btn-tmap" style="flex:1; padding:6px; font-size:11px; font-weight:600; border-radius:4px; text-decoration:none; text-align:center;">
                            <i class="fa-solid fa-diamond-turn-right"></i> 티맵 길찾기
                        </a>
                        <a href="${kakaoNavUrl}" target="_blank" class="popup-btn popup-btn-kakao" style="flex:1; padding:6px; font-size:11px; font-weight:600; border-radius:4px; text-decoration:none; text-align:center;">
                            <i class="fa-solid fa-map"></i> 카카오맵
                        </a>
                    </div>
                    <div class="popup-tail"></div>
                </div>
            `;
        } else {
            // Single senior center popup
            const naverNavUrl = getTmapNavUrl(firstPlace);
            const kakaoNavUrl = `https://map.kakao.com/link/search/${encodeURIComponent(firstPlace.address)}`;
            const statusOptionsHtml = renderStatusOptionsHtml(firstStatusObj.id);

            popupEl.innerHTML = `
                <div class="shadow-popup">
                    <div class="popup-header-row">
                        <span class="popup-title" style="font-size:14.5px; font-weight:700; color:#111; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:6px;" title="${escapeHtml(firstDisplayName)}">👵 ${escapeHtml(firstDisplayName)}</span>
                        <div class="popup-header-actions">
                            <button type="button" class="popup-edit-btn" data-id="${firstPlace.id}" title="주소 및 정보 수정" aria-label="수정">
                                <i class="fa-solid fa-pencil"></i>
                            </button>
                            <button type="button" class="popup-close-btn" aria-label="닫기">&times;</button>
                        </div>
                    </div>
                    <div class="popup-status-box">
                        <span style="font-size:12px; font-weight:700; color:#475569; display:flex; align-items:center; gap:5px; white-space:nowrap;">
                            <i class="fa-solid fa-clipboard-check" style="color:#6366f1;"></i> 방문 결과
                        </span>
                        <select class="popup-status-select" data-id="${firstPlace.id}" style="background:${firstStatusObj.color}; color:${getContrastTextColor(firstStatusObj.color)};">
                            ${statusOptionsHtml}
                        </select>
                    </div>
                    <div class="popup-address" style="font-size:12px; color:#555; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; gap:6px;">
                        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(firstPlace.address)}">
                            <i class="fa-solid fa-location-dot" style="color:#ef4444;"></i> ${escapeHtml(firstPlace.address)}
                        </span>
                        <button type="button" class="popup-edit-btn popup-addr-edit-btn" data-id="${firstPlace.id}" title="주소 수정" aria-label="주소 수정">
                            <i class="fa-solid fa-pencil"></i>
                        </button>
                    </div>
                    ${renderContactsHtml(getPlaceContacts(firstPlace), true, firstPlace.id)}
                    <div class="popup-memo-box">
                        <div class="popup-memo-title">
                            <span><i class="fa-solid fa-note-sticky" style="color:#d97706;"></i> 특이사항 / 메모</span>
                            <span class="popup-memo-status-msg" data-memo-msg-for="${firstPlace.id}" style="font-size:11px; font-weight:700; color:#16a34a;"></span>
                        </div>
                        <textarea class="popup-memo-textarea" data-id="${firstPlace.id}" rows="2" placeholder="특이사항 / 방문메모 입력...">${escapeHtml(firstPlace.memo || "")}</textarea>
                    </div>
                    <div class="popup-actions" style="display:flex; gap:6px; margin-top:6px;">
                        <a href="${naverNavUrl}" class="popup-btn popup-btn-tmap" style="flex:1; padding:6px; font-size:11px; font-weight:600; border-radius:4px; text-decoration:none; text-align:center;">
                            <i class="fa-solid fa-diamond-turn-right"></i> 티맵 길찾기
                        </a>
                        <a href="${kakaoNavUrl}" target="_blank" class="popup-btn popup-btn-kakao" style="flex:1; padding:6px; font-size:11px; font-weight:600; border-radius:4px; text-decoration:none; text-align:center;">
                            <i class="fa-solid fa-map"></i> 카카오맵
                        </a>
                    </div>
                    <div class="popup-tail"></div>
                </div>
            `;
        }

        const popupOverlay = new kakao.maps.CustomOverlay({
            position: position,
            content: popupEl,
            xAnchor: 0.5,
            yAnchor: 1.14,
            zIndex: 10000
        });

        // Link popup & overlay to each place in this cluster
        clusterPlaces.forEach(p => {
            p._kakaoOverlayContent = content;
            p._kakaoPopup = popupOverlay;
            p._kakaoPopupEl = popupEl;
            p._kakaoCluster = cluster;
        });
        state.kakaoOverlays.push(popupOverlay);

        // Keep popup visible if any place in this cluster is selected
        const isClusterSelected = clusterPlaces.some(p => p.id === state.selectedPlaceId);
        if (isClusterSelected) {
            popupOverlay.setMap(state.kakaoMap);
        } else {
            popupOverlay.setMap(null);
        }

        // Prevent pin badge events from bubbling to map
        ["click", "mousedown", "mouseup", "touchstart", "touchend", "pointerdown", "pointerup"].forEach(evtName => {
            content.addEventListener(evtName, (e) => {
                e.stopPropagation();
            });
        });

        // Toggle popup on pin click
        content.addEventListener("click", (e) => {
            e.stopPropagation();
            if (isClusterSelected && popupOverlay.getMap()) {
                popupOverlay.setMap(null);
                state.selectedPlaceId = null;
                renderPlaceListUIOnly();
            } else {
                selectPlace(firstPlace.id);
            }
        });

        // Prevent popup card events from bubbling to map
        ["click", "mousedown", "mouseup", "touchstart", "touchend", "pointerdown", "pointerup"].forEach(evtName => {
            popupEl.addEventListener(evtName, (e) => {
                e.stopPropagation();
            });
        });

        // Edit button click inside popup (opens comprehensive place & address edit modal)
        popupEl.querySelectorAll(".popup-edit-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                e.preventDefault();
                const targetId = btn.getAttribute("data-id");
                if (targetId) {
                    openPlaceEditModal(targetId);
                }
            });
        });

        // Status select changes inside popup
        popupEl.querySelectorAll(".popup-status-select").forEach(sel => {
            sel.addEventListener("change", (e) => {
                e.stopPropagation();
                const targetId = sel.getAttribute("data-id");
                if (targetId) {
                    updatePlaceStatus(targetId, e.target.value);
                }
            });
        });

        // Memo textarea changes inside popup (Mobile & Desktop)
        popupEl.querySelectorAll(".popup-memo-textarea").forEach(textarea => {
            // Prevent map dragging / gestures while typing on mobile
            ["touchstart", "touchmove", "touchend", "mousedown", "click", "keydown", "keyup"].forEach(evtName => {
                textarea.addEventListener(evtName, (e) => {
                    e.stopPropagation();
                });
            });

            let memoDebounceTimer = null;
            textarea.addEventListener("input", (e) => {
                const targetId = textarea.getAttribute("data-id");
                if (!targetId) return;
                clearTimeout(memoDebounceTimer);
                memoDebounceTimer = setTimeout(() => {
                    updatePlaceMemo(targetId, e.target.value, false);
                }, 600);
            });

            textarea.addEventListener("blur", (e) => {
                const targetId = textarea.getAttribute("data-id");
                if (targetId) {
                    clearTimeout(memoDebounceTimer);
                    updatePlaceMemo(targetId, e.target.value, false);
                }
            });
        });

        // Memo Explicit Save Button inside popup
        popupEl.querySelectorAll(".btn-save-popup-memo").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const targetId = btn.getAttribute("data-id");
                const textarea = popupEl.querySelector(`.popup-memo-textarea[data-id="${targetId}"]`);
                if (!targetId || !textarea) return;

                const textVal = textarea.value.trim();
                updatePlaceMemo(targetId, textVal, true);

                // Show instant visual confirmation
                const msgSpan = popupEl.querySelector(`[data-memo-msg-for="${targetId}"]`);
                if (msgSpan) {
                    msgSpan.textContent = "✓ 저장 완료";
                    setTimeout(() => { if (msgSpan) msgSpan.textContent = ""; }, 2500);
                }
                btn.classList.add("saved");
                btn.innerHTML = '<i class="fa-solid fa-check"></i> 저장됨';
                setTimeout(() => {
                    btn.classList.remove("saved");
                    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> 메모 저장';
                }, 2000);
            });
        });

        const closeBtn = popupEl.querySelector(".popup-close-btn");
        if (closeBtn) {
            closeBtn.addEventListener("click", (e) => {
                e.stopPropagation();

                // Safety Guarantee: Force save all memo textareas in this popup before closing
                popupEl.querySelectorAll(".popup-memo-textarea").forEach(ta => {
                    const tId = ta.getAttribute("data-id");
                    if (tId) {
                        updatePlaceMemo(tId, ta.value.trim(), true);
                    }
                });

                popupOverlay.setMap(null);
                if (clusterPlaces.some(p => p.id === state.selectedPlaceId)) {
                    state.selectedPlaceId = null;
                    renderPlaceListUIOnly();
                }
            });
        }

        state.kakaoInfoWindows.push(popupOverlay);
    });

    if (hasPoints && shouldFitBounds) {
        state.kakaoMap.setBounds(bounds);
    }
}

/* ----------------------------------------------------
   2. OpenStreetMap / Leaflet Engine (Fallback)
---------------------------------------------------- */
function initLeafletMap() {
    document.getElementById("kakao-map").style.display = "none";
    document.getElementById("leaflet-map").style.display = "block";

    if (!state.leafletMap) {
        state.leafletMap = L.map("leaflet-map", {
            center: [35.0682, 127.7511],
            zoom: 11
        });

        state.leafletTileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            subdomains: "abc",
            attribution: "&copy; OpenStreetMap contributors"
        }).addTo(state.leafletMap);
    } else {
        state.leafletMap.invalidateSize();
    }
}

function renderLeafletMarkers(places = null, shouldFitBounds = false) {
    if (!state.leafletMap) return;

    places = (Array.isArray(places) && places.length > 0) ? places : getFilteredPlaces();

    Object.values(state.leafletMarkers).forEach(m => state.leafletMap.removeLayer(m));
    state.leafletMarkers = {};

    const bounds = [];
    const groupPlaces = (!state.activeGroup ? [] : state.places.filter(p => p.group === state.activeGroup))
        .filter(p => !isHeaderRow(p.name, p.address));

    const clusters = groupPlacesByLocation(places);

    clusters.forEach((cluster) => {
        const clusterPlaces = cluster.places;
        const count = clusterPlaces.length;
        const latLng = [cluster.lat, cluster.lng];
        bounds.push(latLng);

        const firstPlace = clusterPlaces[0];
        const firstSeq = groupPlaces.indexOf(firstPlace) + 1;
        const firstStatusObj = getStatusObj(firstPlace.status);
        const firstDisplayName = sanitizeName(firstPlace.name, firstPlace.address);
        const isMulti = count > 1;

        let iconHtml = "";
        if (isMulti) {
            const seqNums = clusterPlaces.map(p => {
                const s = groupPlaces.indexOf(p) + 1;
                return s > 0 ? s : "";
            }).filter(Boolean);
            const seqStr = seqNums.length > 0 ? seqNums.join(",") : "";

            iconHtml = `
                <div class="custom-pin-badge is-multi-building" style="border-color: #2563eb;">
                    <span class="pin-number multi-building-icon">🏢</span>
                    <span class="pin-label" style="color:#1d4ed8; font-weight:800;">
                        ${seqStr ? `${seqStr}. ` : ''}${escapeHtml(firstDisplayName)} 외 ${count - 1}곳 (동일건물)
                    </span>
                </div>
            `;
        } else {
            const displaySeq = firstSeq > 0 ? firstSeq : "";
            iconHtml = `
                <div class="custom-pin-badge" style="border-color: ${firstStatusObj.color};">
                    <span class="pin-number" style="background: ${firstStatusObj.color};">${displaySeq}</span>
                    <span class="pin-label">${escapeHtml(firstDisplayName)}</span>
                </div>
            `;
        }

        const customIcon = L.divIcon({
            className: "custom-div-icon",
            html: buildPinBadgeHtml(clusterPlaces, groupPlaces),
            iconSize: state.pinDisplayMode !== "number_name" ? [isMulti ? 60 : 28, 24] : [isMulti ? 150 : 110, 24],
            iconAnchor: [12, 24],
            popupAnchor: [0, -24]
        });

        let popupContent = "";
        if (isMulti) {
            let itemsHtml = "";
            clusterPlaces.forEach((p) => {
                const seq = groupPlaces.indexOf(p) + 1;
                const dSeq = seq > 0 ? `${seq}. ` : "";
                const dName = sanitizeName(p.name, p.address);
                const sObj = getStatusObj(p.status);
                const stOptions = renderStatusOptionsHtml(sObj.id);
                const cHtml = renderContactsHtml(getPlaceContacts(p), true, p.id);

                itemsHtml += `
                    <div class="multi-place-item" data-place-id="${p.id}">
                        <div class="multi-place-item-top">
                            <span class="multi-place-name" title="${escapeHtml(dName)}">
                                <span style="color:#2563eb; font-weight:800;">${dSeq}</span>👵 ${escapeHtml(dName)}
                            </span>
                            <div style="display:flex; align-items:center; gap:5px;">
                                <button type="button" class="popup-edit-btn" data-id="${p.id}" title="주소 및 정보 수정" aria-label="수정">
                                    <i class="fa-solid fa-pencil"></i>
                                </button>
                                <select class="popup-status-select multi-status-select" data-id="${p.id}" style="background:${sObj.color}; color:${getContrastTextColor(sObj.color)};">
                                    ${stOptions}
                                </select>
                            </div>
                        </div>
                        <div class="popup-address" style="font-size:11.5px; color:#64748b; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center; gap:4px;">
                            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(p.address)}">
                                <i class="fa-solid fa-location-dot" style="color:#ef4444;"></i> ${escapeHtml(p.address)}
                            </span>
                            <button type="button" class="popup-edit-btn popup-addr-edit-btn" data-id="${p.id}" title="주소 수정" aria-label="주소 수정">
                                <i class="fa-solid fa-pencil"></i>
                            </button>
                        </div>
                        ${cHtml}
                        <div class="popup-memo-box">
                            <div class="popup-memo-title">
                                <span><i class="fa-solid fa-note-sticky" style="color:#d97706;"></i> 특이사항 / 메모</span>
                            </div>
                            <textarea class="popup-memo-textarea" data-id="${p.id}" rows="2" placeholder="특이사항 / 방문메모 입력...">${escapeHtml(p.memo || "")}</textarea>
                            <div class="popup-memo-footer">
                                <span class="popup-memo-status-msg" data-memo-msg-for="${p.id}"></span>
                                <button type="button" class="btn-save-popup-memo" data-id="${p.id}">
                                    <i class="fa-solid fa-floppy-disk"></i> 메모 저장
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });

            const naverUrl = getTmapNavUrl(firstPlace);
            const kakaoUrl = `https://map.kakao.com/link/search/${encodeURIComponent(firstPlace.address)}`;

            popupContent = `
                <div class="popup-card" style="width:300px; padding:12px;">
                    <div style="background:#2563eb; color:#ffffff; margin:-12px -12px 10px -12px; padding:8px 12px; border-top-left-radius:8px; border-top-right-radius:8px; font-weight:700; font-size:13px; display:flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-building"></i> 동일 건물 경로당 (${count}개)
                    </div>
                    <div class="multi-place-list">
                        ${itemsHtml}
                    </div>
                    <div class="popup-actions" style="margin-top:8px; display:flex; gap:6px;">
                        <a href="${naverUrl}" class="popup-btn popup-btn-tmap" style="flex:1; padding:6px; font-size:11px; font-weight:600; text-align:center;">티맵 길찾기</a>
                        <a href="${kakaoUrl}" target="_blank" class="popup-btn popup-btn-kakao" style="flex:1; padding:6px; font-size:11px; font-weight:600; text-align:center;">카카오맵</a>
                    </div>
                </div>
            `;
        } else {
            const naverUrl = getTmapNavUrl(firstPlace);
            const kakaoUrl = `https://map.kakao.com/link/search/${encodeURIComponent(firstPlace.address)}`;
            const statusOptionsHtml = renderStatusOptionsHtml(firstStatusObj.id);

            popupContent = `
                <div class="popup-card">
                    <div class="popup-header-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <span class="popup-title" style="font-size:14.5px; font-weight:700; color:#111; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:6px;" title="${escapeHtml(firstDisplayName)}">👵 ${escapeHtml(firstDisplayName)}</span>
                        <div class="popup-header-actions">
                            <button type="button" class="popup-edit-btn" data-id="${firstPlace.id}" title="주소 및 정보 수정" aria-label="수정">
                                <i class="fa-solid fa-pencil"></i>
                            </button>
                        </div>
                    </div>
                    <div class="popup-status-box">
                        <span style="font-size:12px; font-weight:700; color:#475569; display:flex; align-items:center; gap:5px; white-space:nowrap;">
                            <i class="fa-solid fa-clipboard-check" style="color:#6366f1;"></i> 방문 결과
                        </span>
                        <select class="popup-status-select" data-id="${firstPlace.id}" style="background:${firstStatusObj.color}; color:${getContrastTextColor(firstStatusObj.color)};">
                            ${statusOptionsHtml}
                        </select>
                    </div>
                    <div class="popup-address" style="font-size:12px; color:#555; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; gap:6px;">
                        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(firstPlace.address)}">
                            <i class="fa-solid fa-location-dot" style="color:#ef4444;"></i> ${escapeHtml(firstPlace.address)}
                        </span>
                        <button type="button" class="popup-edit-btn popup-addr-edit-btn" data-id="${firstPlace.id}" title="주소 수정" aria-label="주소 수정">
                            <i class="fa-solid fa-pencil"></i>
                        </button>
                    </div>
                    ${renderContactsHtml(getPlaceContacts(firstPlace), true, firstPlace.id)}
                    <div class="popup-memo-box">
                        <div class="popup-memo-title">
                            <span><i class="fa-solid fa-note-sticky" style="color:#d97706;"></i> 특이사항 / 메모</span>
                        </div>
                        <textarea class="popup-memo-textarea" data-id="${firstPlace.id}" rows="2" placeholder="특이사항 / 방문메모 입력...">${escapeHtml(firstPlace.memo || "")}</textarea>
                        <div class="popup-memo-footer">
                            <span class="popup-memo-status-msg" data-memo-msg-for="${firstPlace.id}"></span>
                            <button type="button" class="btn-save-popup-memo" data-id="${firstPlace.id}">
                                <i class="fa-solid fa-floppy-disk"></i> 메모 저장
                            </button>
                        </div>
                    </div>
                    <div class="popup-actions" style="margin-top:6px; display:flex; gap:6px;">
                        <a href="${naverUrl}" class="popup-btn popup-btn-tmap" style="flex:1; padding:6px; font-size:11px; font-weight:600; text-align:center;">티맵 길찾기</a>
                        <a href="${kakaoUrl}" target="_blank" class="popup-btn popup-btn-kakao" style="flex:1; padding:6px; font-size:11px; font-weight:600; text-align:center;">카카오맵</a>
                    </div>
                </div>
            `;
        }

        const marker = L.marker(latLng, { icon: customIcon }).addTo(state.leafletMap);
        marker.bindPopup(popupContent);

        marker.on("click", () => {
            selectPlace(firstPlace.id);
        });

        marker.on("popupopen", (e) => {
            const popupNode = e.popup.getElement();
            if (popupNode) {
                popupNode.querySelectorAll(".popup-edit-btn").forEach(btn => {
                    btn.addEventListener("click", (ev) => {
                        ev.stopPropagation();
                        ev.preventDefault();
                        const pId = btn.getAttribute("data-id");
                        if (pId) {
                            openPlaceEditModal(pId);
                        }
                    });
                });

                popupNode.querySelectorAll(".popup-status-select").forEach(sel => {
                    sel.addEventListener("change", (ev) => {
                        ev.stopPropagation();
                        const pId = sel.getAttribute("data-id");
                        if (pId) {
                            updatePlaceStatus(pId, ev.target.value);
                        }
                    });
                });

                popupNode.querySelectorAll(".popup-memo-textarea").forEach(textarea => {
                    ["touchstart", "touchmove", "touchend", "mousedown", "click", "keydown", "keyup"].forEach(evtName => {
                        textarea.addEventListener(evtName, (ev) => {
                            ev.stopPropagation();
                        });
                    });

                    let memoDebounceTimer = null;
                    textarea.addEventListener("input", (ev) => {
                        const targetId = textarea.getAttribute("data-id");
                        if (!targetId) return;
                        clearTimeout(memoDebounceTimer);
                        memoDebounceTimer = setTimeout(() => {
                            updatePlaceMemo(targetId, ev.target.value, false);
                        }, 600);
                    });

                    textarea.addEventListener("blur", (ev) => {
                        const targetId = textarea.getAttribute("data-id");
                        if (targetId) {
                            clearTimeout(memoDebounceTimer);
                            updatePlaceMemo(targetId, ev.target.value, false);
                        }
                    });
                });

                // Explicit memo save button in Leaflet popup
                popupNode.querySelectorAll(".btn-save-popup-memo").forEach(btn => {
                    btn.addEventListener("click", (ev) => {
                        ev.stopPropagation();
                        const targetId = btn.getAttribute("data-id");
                        const textarea = popupNode.querySelector(`.popup-memo-textarea[data-id="${targetId}"]`);
                        if (!targetId || !textarea) return;

                        const textVal = textarea.value.trim();
                        updatePlaceMemo(targetId, textVal, true);

                        const msgSpan = popupNode.querySelector(`[data-memo-msg-for="${targetId}"]`);
                        if (msgSpan) {
                            msgSpan.textContent = "✓ 저장 완료";
                            setTimeout(() => { if (msgSpan) msgSpan.textContent = ""; }, 2500);
                        }
                        btn.classList.add("saved");
                        btn.innerHTML = '<i class="fa-solid fa-check"></i> 저장됨';
                        setTimeout(() => {
                            btn.classList.remove("saved");
                            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> 메모 저장';
                        }, 2000);
                    });
                });
            }
        });

        // Force-save on popup close
        marker.on("popupclose", (e) => {
            const popupNode = e.popup.getElement();
            if (popupNode) {
                popupNode.querySelectorAll(".popup-memo-textarea").forEach(ta => {
                    const tId = ta.getAttribute("data-id");
                    if (tId) {
                        updatePlaceMemo(tId, ta.value.trim(), true);
                    }
                });
            }
        });

        clusterPlaces.forEach(p => {
            state.leafletMarkers[p.id] = marker;
        });
    });

    if (bounds.length > 0 && shouldFitBounds) {
        state.leafletMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
}

/* ----------------------------------------------------
   UI Event Handlers & Modal Logic
---------------------------------------------------- */
function initUIEvents() {
    document.querySelectorAll(".pin-mode-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const mode = btn.getAttribute("data-pin-mode");
            if (mode) setPinDisplayMode(mode);
        });
    });
    const groupSelect = document.getElementById("group-select");
    groupSelect.addEventListener("change", (e) => {
        state.activeGroup = e.target.value;
        state.selectedPlaceId = null;
        renderPlaceList(true);
    });

    document.getElementById("btn-add-group").addEventListener("click", () => {
        const newGroup = prompt("새 리스트/그룹 이름을 입력하세요:", "새 경로당 그룹");
        if (newGroup && newGroup.trim()) {
            const groupName = newGroup.trim();
            if (!state.groups.includes(groupName)) {
                state.groups.push(groupName);
                saveState();
                renderGroupSelect();
            }
            state.activeGroup = groupName;
            groupSelect.value = groupName;
            renderPlaceList();
        }
    });

    const btnEditGroup = document.getElementById("btn-edit-group");
    if (btnEditGroup) {
        btnEditGroup.addEventListener("click", () => {
            if (!state.activeGroup) {
                alert("📁 폴더 미선택 상태에서는 폴더 이름을 수정할 수 없습니다. 먼저 수정할 경로당 폴더를 선택해 주세요.");
                return;
            }

            const oldName = state.activeGroup;
            const inputName = prompt(`[📁 ${oldName}] 폴더의 새로운 이름을 입력하세요:`, oldName);
            if (!inputName || !inputName.trim()) return;

            const newName = inputName.trim();
            if (newName === oldName) return;

            if (state.groups.includes(newName)) {
                alert(`이미 [📁 ${newName}] 폴더가 존재합니다. 다른 이름을 사용해 주세요.`);
                return;
            }

            const idx = state.groups.indexOf(oldName);
            if (idx !== -1) {
                state.groups[idx] = newName;
            }

            state.places.forEach(p => {
                if (p.group === oldName) {
                    p.group = newName;
                }
            });

            state.activeGroup = newName;

            saveState();
            renderGroupSelect();
            renderPlaceList();

            alert(`[📁 ${oldName}] 폴더 이름이 [📁 ${newName}](으)로 변경되었습니다!`);
        });
    }

    document.getElementById("btn-delete-group").addEventListener("click", () => {
        if (!state.activeGroup) {
            alert("📁 폴더 미선택 상태에서는 특정 폴더를 선택하지 않아 삭제할 수 없습니다. 먼저 삭제할 경로당 폴더를 선택해 주세요.");
            return;
        }

        const targetGroup = state.activeGroup;
        const countInGroup = state.places.filter(p => p.group === targetGroup && !isHeaderRow(p.name, p.address)).length;

        if (confirm(`정말로 [📁 ${targetGroup}] 폴더와 해당 폴더에 포함된 경로당 ${countInGroup}곳을 완전히 삭제하시겠습니까?`)) {
            state.groups = state.groups.filter(g => g !== targetGroup);
            state.places = state.places.filter(p => p.group !== targetGroup);

            state.activeGroup = "";

            saveState();
            renderGroupSelect();
            renderPlaceList();

            alert(`[📁 ${targetGroup}] 폴더가 삭제되었습니다.`);
        }
    });

    const searchInput = document.getElementById("search-input");
    const btnClearSearch = document.getElementById("btn-clear-search");

    searchInput.addEventListener("input", (e) => {
        state.searchKeyword = e.target.value.trim();
        btnClearSearch.style.display = state.searchKeyword ? "block" : "none";
        renderPlaceList();
    });

    btnClearSearch.addEventListener("click", () => {
        searchInput.value = "";
        state.searchKeyword = "";
        btnClearSearch.style.display = "none";
        renderPlaceList();
    });

    document.querySelectorAll(".summary-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            document.querySelectorAll(".summary-chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            state.activeFilter = chip.dataset.filter;
            renderPlaceList();
        });
    });

    // Modals
    const modalImport = document.getElementById("modal-import");
    const modalKakaoKey = document.getElementById("modal-kakao-key");
    const modalMobile = document.getElementById("modal-mobile");

    function openImportModalAutoPopulate() {
        renderImportGroupSelect();
        
        const pasteInput = document.getElementById("paste-input");
        const chkHasHeader = document.getElementById("chk-has-header-row");
        if (chkHasHeader) chkHasHeader.checked = false;

        // Auto-populate: if current folder already has registered places, load them.
        // If it's a new or empty folder, leave pasteInput completely blank so user can paste their own data cleanly!
        if (state.activeGroup) {
            const currentGroupPlaces = state.places.filter(p => p.group === state.activeGroup && !isHeaderRow(p.name, p.address));
            if (currentGroupPlaces.length > 0) {
                pasteInput.value = generatePlacesImportText(currentGroupPlaces);
            } else {
                pasteInput.value = "";
            }
        } else {
            pasteInput.value = "";
        }

        lastParsedText = ""; // Reset to trigger column auto-detection
        updateColumnMappingUI();
        modalImport.style.display = "flex";
    }

    document.getElementById("btn-open-import").addEventListener("click", () => {
        openImportModalAutoPopulate();
    });

    const btnEmptyImport = document.getElementById("btn-empty-import");
    if (btnEmptyImport) {
        btnEmptyImport.addEventListener("click", () => {
            openImportModalAutoPopulate();
        });
    }

    const importSelect = document.getElementById("import-group-select");
    if (importSelect) {
        importSelect.addEventListener("change", (e) => {
            if (e.target.value === "__new__") {
                handleCreateNewImportGroup();
            } else if (e.target.value) {
                const grpPlaces = state.places.filter(p => p.group === e.target.value && !isHeaderRow(p.name, p.address));
                const pasteInput = document.getElementById("paste-input");
                if (pasteInput) {
                    if (grpPlaces.length > 0) {
                        pasteInput.value = generatePlacesImportText(grpPlaces);
                    } else {
                        pasteInput.value = "";
                    }
                    lastParsedText = "";
                    updateColumnMappingUI();
                }
            } else {
                const pasteInput = document.getElementById("paste-input");
                if (pasteInput) {
                    pasteInput.value = "";
                    lastParsedText = "";
                    updateColumnMappingUI();
                }
            }
        });
    }

    const btnImportNewGroup = document.getElementById("btn-import-new-group");
    if (btnImportNewGroup) {
        btnImportNewGroup.addEventListener("click", () => {
            handleCreateNewImportGroup();
        });
    }

    const btnOpenMobile = document.getElementById("btn-open-mobile");
    if (btnOpenMobile) {
        btnOpenMobile.addEventListener("click", () => {
            const urlDisplay = document.getElementById("mobile-url-display");
            if (urlDisplay && window.location.protocol.startsWith("http")) {
                urlDisplay.textContent = window.location.origin + window.location.pathname;
            }
            if (modalMobile) modalMobile.style.display = "flex";
        });
    }

    const btnCopyMobileUrl = document.getElementById("btn-copy-mobile-url");
    if (btnCopyMobileUrl) {
        btnCopyMobileUrl.addEventListener("click", () => {
            const urlText = document.getElementById("mobile-url-display").textContent.trim();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(urlText).then(() => {
                    alert(`📱 접속 주소가 복사되었습니다:\n${urlText}\n\n스마트폰 카카오톡이나 브라우저 주소창에 붙여넣으세요!`);
                }).catch(() => {
                    prompt("아래 주소를 복사하세요:", urlText);
                });
            } else {
                prompt("아래 주소를 복사하세요:", urlText);
            }
        });
    }

    const btnSaveAllChanges = document.getElementById("btn-save-all-changes");
    if (btnSaveAllChanges) {
        btnSaveAllChanges.addEventListener("click", async () => {
            const originalHtml = btnSaveAllChanges.innerHTML;
            btnSaveAllChanges.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 저장 중...`;
            btnSaveAllChanges.disabled = true;

            try {
                await saveState("web");
                btnSaveAllChanges.innerHTML = `<i class="fa-solid fa-check"></i> 저장 완료!`;
                btnSaveAllChanges.style.background = "#10b981";
                btnSaveAllChanges.style.borderColor = "#059669";
                setTimeout(() => {
                    btnSaveAllChanges.innerHTML = originalHtml;
                    btnSaveAllChanges.style.background = "#2563eb";
                    btnSaveAllChanges.style.borderColor = "#1d4ed8";
                    btnSaveAllChanges.disabled = false;
                }, 1800);
            } catch (err) {
                alert("저장 중 오류가 발생했습니다: " + err.message);
                btnSaveAllChanges.innerHTML = originalHtml;
                btnSaveAllChanges.disabled = false;
            }
        });
    }

    const btnMobileSaveAll = document.getElementById("btn-mobile-save-all");
    if (btnMobileSaveAll) {
        btnMobileSaveAll.addEventListener("click", async () => {
            const originalHtml = btnMobileSaveAll.innerHTML;
            btnMobileSaveAll.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
            btnMobileSaveAll.disabled = true;

            try {
                await saveState("mobile");
                btnMobileSaveAll.innerHTML = `<i class="fa-solid fa-check"></i> 완료`;
                btnMobileSaveAll.style.background = "#10b981";
                setTimeout(() => {
                    btnMobileSaveAll.innerHTML = originalHtml;
                    btnMobileSaveAll.style.background = "#2563eb";
                    btnMobileSaveAll.disabled = false;
                }, 1800);
            } catch (err) {
                alert("모바일 저장 중 오류가 발생했습니다: " + err.message);
                btnMobileSaveAll.innerHTML = originalHtml;
                btnMobileSaveAll.disabled = false;
            }
        });
    }

    document.getElementById("btn-kakao-key-setting").addEventListener("click", () => {
        document.getElementById("input-kakao-js-key").value = state.kakaoJsKey;
        modalKakaoKey.style.display = "flex";
    });

    const btnMobileKakaoKey = document.getElementById("btn-mobile-kakao-key");
    if (btnMobileKakaoKey) {
        btnMobileKakaoKey.addEventListener("click", () => {
            document.getElementById("input-kakao-js-key").value = state.kakaoJsKey;
            modalKakaoKey.style.display = "flex";
        });
    }

    const modalEditContacts = document.getElementById("modal-edit-contacts");
    const modalMasterLogin = document.getElementById("modal-master-login");
    const modalSalesReps = document.getElementById("modal-sales-reps");
    const modalMasterBackup = document.getElementById("modal-master-backup");
    const modalAssignSalesRep = document.getElementById("modal-assign-sales-rep");
    const modalStatusSetting = document.getElementById("modal-status-setting");

    document.querySelectorAll(".btn-close-modal").forEach(btn => {
        btn.addEventListener("click", () => {
            if (modalImport) modalImport.style.display = "none";
            if (modalKakaoKey) modalKakaoKey.style.display = "none";
            if (modalMobile) modalMobile.style.display = "none";
            if (modalEditContacts) modalEditContacts.style.display = "none";
            if (modalMasterLogin) modalMasterLogin.style.display = "none";
            if (modalSalesReps) modalSalesReps.style.display = "none";
            if (modalMasterBackup) modalMasterBackup.style.display = "none";
            if (modalAssignSalesRep) modalAssignSalesRep.style.display = "none";
            if (modalStatusSetting && modalStatusSetting.style.display === "flex") {
                syncStatusModalInputsSilently();
                modalStatusSetting.style.display = "none";
            }
        });
    });

    const btnOpenStatusSetting = document.getElementById("btn-open-status-setting");
    if (btnOpenStatusSetting) {
        btnOpenStatusSetting.addEventListener("click", () => {
            renderStatusSettingModal();
            if (modalStatusSetting) modalStatusSetting.style.display = "flex";
        });
    }

    const btnAddStatusItem = document.getElementById("btn-add-status-item");
    if (btnAddStatusItem) {
        btnAddStatusItem.addEventListener("click", () => {
            const nameInput = document.getElementById("new-status-name-input");
            if (nameInput) {
                addCustomStatus(nameInput.value, selectedNewStatusColor || "#22c55e");
                nameInput.value = "";
            }
        });
    }

    const btnSaveStatusSettings = document.getElementById("btn-save-status-settings");
    if (btnSaveStatusSettings) {
        btnSaveStatusSettings.addEventListener("click", () => {
            saveCustomStatusSettings();
        });
    }

    // Close any open palette popovers when clicking outside
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".btn-color-palette-trigger") && !e.target.closest(".color-palette-popover")) {
            document.querySelectorAll(".color-palette-popover").forEach(p => p.style.display = "none");
        }
    });

    const btnResetStatusLabels = document.getElementById("btn-reset-status-labels");
    if (btnResetStatusLabels) {
        btnResetStatusLabels.addEventListener("click", resetCustomStatuses);
    }

    const btnMasterLogin = document.getElementById("btn-master-login");
    if (btnMasterLogin) {
        btnMasterLogin.addEventListener("click", () => {
            updateMasterUI();
            if (modalMasterLogin) modalMasterLogin.style.display = "flex";
        });
    }

    const btnSubmitMasterLogin = document.getElementById("btn-submit-master-login");
    if (btnSubmitMasterLogin) {
        btnSubmitMasterLogin.addEventListener("click", () => {
            const inputPin = document.getElementById("input-master-pin").value.trim();
            if (inputPin === state.masterPin) {
                state.isMaster = true;
                sessionStorage.setItem("is_master", "true");
                updateMasterUI();
                alert("👑 마스터 계정 인증이 성공했습니다!");
            } else {
                alert("❌ 마스터 비밀번호가 올바르지 않습니다. (기본: 1234)");
            }
        });
    }

    const btnMasterLogout = document.getElementById("btn-master-logout");
    if (btnMasterLogout) {
        btnMasterLogout.addEventListener("click", () => {
            state.isMaster = false;
            sessionStorage.removeItem("is_master");
            updateMasterUI();
            if (modalMasterLogin) modalMasterLogin.style.display = "none";
            alert("로그아웃되었습니다.");
        });
    }

    const btnChangeMasterPin = document.getElementById("btn-change-master-pin");
    if (btnChangeMasterPin) {
        btnChangeMasterPin.addEventListener("click", () => {
            const newPin = document.getElementById("input-new-master-pin").value.trim();
            if (!newPin || newPin.length < 4) {
                alert("새 마스터 비밀번호는 4자리 이상 입력해 주세요.");
                return;
            }
            state.masterPin = newPin;
            localStorage.setItem("master_pin", newPin);
            alert(`🔑 마스터 비밀번호가 변경되었습니다!`);
            document.getElementById("input-new-master-pin").value = "";
        });
    }

    const btnOpenSalesReps = document.getElementById("btn-open-sales-reps");
    if (btnOpenSalesReps) {
        btnOpenSalesReps.addEventListener("click", () => {
            renderSalesRepSelects();
            if (modalSalesReps) modalSalesReps.style.display = "flex";
        });
    }

    const btnAddSalesRep = document.getElementById("btn-add-sales-rep");
    if (btnAddSalesRep) {
        btnAddSalesRep.addEventListener("click", () => {
            const name = document.getElementById("input-sales-rep-name").value;
            const phone = document.getElementById("input-sales-rep-phone").value;
            const memo = document.getElementById("input-sales-rep-memo").value;
            addSalesRep(name, phone, memo);
            document.getElementById("input-sales-rep-name").value = "";
            document.getElementById("input-sales-rep-phone").value = "";
            document.getElementById("input-sales-rep-memo").value = "";
        });
    }

    const salesRepFilterSelect = document.getElementById("sales-rep-filter-select");
    if (salesRepFilterSelect) {
        salesRepFilterSelect.addEventListener("change", (e) => {
            state.activeSalesRep = e.target.value;
            renderPlaceList(true);
        });
    }

    const btnOpenMasterBackup = document.getElementById("btn-open-master-backup");
    if (btnOpenMasterBackup) {
        btnOpenMasterBackup.addEventListener("click", () => {
            if (modalMasterBackup) {
                modalMasterBackup.style.display = "flex";
                renderSnapshotList();
            }
        });
    }

    const btnRefreshSnapshots = document.getElementById("btn-refresh-snapshots");
    if (btnRefreshSnapshots) {
        btnRefreshSnapshots.addEventListener("click", renderSnapshotList);
    }

    const btnDownloadMasterExcel = document.getElementById("btn-download-master-excel");
    if (btnDownloadMasterExcel) {
        btnDownloadMasterExcel.addEventListener("click", exportMasterBackupExcel);
    }

    const btnExecuteExcelRestore = document.getElementById("btn-execute-excel-restore");
    if (btnExecuteExcelRestore) {
        btnExecuteExcelRestore.addEventListener("click", () => {
            const fileInput = document.getElementById("input-restore-excel-file");
            if (fileInput && fileInput.files && fileInput.files[0]) {
                importMasterBackupExcel(fileInput.files[0]);
            } else {
                alert("복원할 엑셀 (.xlsx) 파일을 먼저 선택해 주세요.");
            }
        });
    }

    const btnDownloadMasterJson = document.getElementById("btn-download-master-json");
    if (btnDownloadMasterJson) {
        btnDownloadMasterJson.addEventListener("click", exportMasterBackupJson);
    }

    const btnExecuteRestore = document.getElementById("btn-execute-restore");
    if (btnExecuteRestore) {
        btnExecuteRestore.addEventListener("click", () => {
            const fileInput = document.getElementById("input-restore-file");
            if (fileInput && fileInput.files && fileInput.files[0]) {
                importMasterBackupJson(fileInput.files[0]);
            } else {
                alert("복원할 마스터 백업 (.json) 파일을 먼저 선택해 주세요.");
            }
        });
    }

    const btnSaveAssignSalesRep = document.getElementById("btn-save-assign-sales-rep");
    if (btnSaveAssignSalesRep) {
        btnSaveAssignSalesRep.addEventListener("click", () => {
            const placeId = document.getElementById("assign-place-id").value;
            const selectVal = document.getElementById("select-assign-sales-rep").value;

            const place = state.places.find(p => p.id === placeId);
            if (place) {
                place.salesRep = selectVal;
                saveState();
                renderPlaceList();
                if (modalAssignSalesRep) modalAssignSalesRep.style.display = "none";
                alert(`[${place.name}] 경로당의 담당 영업사원이 변경되었습니다!`);
            }
        });
    }

    document.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-edit-contacts");
        if (btn) {
            e.stopPropagation();
            const placeId = btn.dataset.id;
            openContactsEditModal(placeId);
        }
    });

    
    // Edit Place Modal Daum Postcode Search Button
    const btnSearchDaumPostcode = document.getElementById("btn-search-daum-postcode");
    if (btnSearchDaumPostcode) {
        btnSearchDaumPostcode.addEventListener("click", () => {
            if (typeof daum !== "undefined" && daum.Postcode) {
                new daum.Postcode({
                    oncomplete: function(data) {
                        const addr = data.roadAddress || data.jibunAddress || "";
                        const addrInput = document.getElementById("edit-place-address");
                        if (addrInput) {
                            addrInput.value = addr;
                        }
                    }
                }).open();
            } else {
                alert("우편번호/주소 검색 서비스 로딩 중입니다. 직접 주소를 입력하셔도 됩니다.");
            }
        });
    }

    // Edit Place Modal Save Button
    const btnSaveEditPlace = document.getElementById("btn-save-edit-place");
    if (btnSaveEditPlace) {
        btnSaveEditPlace.addEventListener("click", async () => {
            const placeId = document.getElementById("edit-place-id").value;
            const place = state.places.find(p => p.id === placeId);
            if (!place) {
                alert("수정할 경로당을 찾을 수 없습니다.");
                return;
            }

            const newName = document.getElementById("edit-place-name").value.trim();
            const newAddress = document.getElementById("edit-place-address").value.trim();
            const newStatus = document.getElementById("edit-place-status").value;

            if (!newName) {
                alert("경로당 명칭을 입력해주세요.");
                return;
            }
            if (!newAddress) {
                alert("주소를 입력해주세요.");
                return;
            }

            btnSaveEditPlace.disabled = true;
            btnSaveEditPlace.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 저장 및 위치 확인 중...';

            place.name = newName;
            const oldAddress = place.address;
            place.address = newAddress;
            place.status = newStatus;

            // Update contacts
            const r1 = (document.getElementById("edit-contact-role-1").value || "회장").trim();
            const p1 = (document.getElementById("edit-contact-phone-1").value || "").trim();
            const r2 = (document.getElementById("edit-contact-role-2").value || "총무").trim();
            const p2 = (document.getElementById("edit-contact-phone-2").value || "").trim();

            const updatedContacts = [];
            if (p1) updatedContacts.push({ role: r1, phone: p1 });
            if (p2) updatedContacts.push({ role: r2, phone: p2 });
            place.contacts = updatedContacts;

            // Update memo
            const memoEl = document.getElementById("edit-place-memo");
            if (memoEl) {
                place.memo = memoEl.value.trim();
            }

            // Re-geocode if address changed or coordinates are missing
            if (oldAddress !== newAddress || !place.lat || !place.lng) {
                try {
                    const geo = await geocodeAddress(newAddress, newName);
                    if (geo && geo.lat && geo.lng) {
                        place.lat = geo.lat;
                        place.lng = geo.lng;
                    }
                } catch (err) {
                    console.warn("Geocoding failed for new address:", err);
                }
            }

            await saveState();
            renderPlaceList();

            // Pan to updated location on map if coordinates available
            if (place.lat && place.lng) {
                if (state.activeMapEngine === "kakao" && state.kakaoMap) {
                    state.kakaoMap.panTo(new kakao.maps.LatLng(place.lat, place.lng));
                } else if (state.leafletMap) {
                    state.leafletMap.panTo([place.lat, place.lng]);
                }
            }

            const modalEditPlace = document.getElementById("modal-edit-place");
            if (modalEditPlace) modalEditPlace.style.display = "none";

            btnSaveEditPlace.disabled = false;
            btnSaveEditPlace.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> 수정사항 저장';

            alert(`[${place.name}] 정보가 성공적으로 수정 및 저장되었습니다!`);
        });
    }

    // Modal close button and backdrop support for modal-edit-place
    const modalEditPlace = document.getElementById("modal-edit-place");
    if (modalEditPlace) {
        modalEditPlace.querySelectorAll(".btn-close-modal").forEach(btn => {
            btn.addEventListener("click", () => {
                modalEditPlace.style.display = "none";
            });
        });
        modalEditPlace.addEventListener("click", (e) => {
            if (e.target === modalEditPlace) {
                modalEditPlace.style.display = "none";
            }
        });
    }

const btnSaveContacts = document.getElementById("btn-save-contacts");
    if (btnSaveContacts) {
        btnSaveContacts.addEventListener("click", () => {
            const placeId = document.getElementById("edit-contacts-place-id").value;
            const place = state.places.find(p => p.id === placeId);
            if (!place) return;

            const val1 = document.getElementById("input-contact-1").value.trim();
            const val2 = document.getElementById("input-contact-2").value.trim();
            const val3 = document.getElementById("input-contact-3").value.trim();

            const newContacts = [];
            [val1, val2, val3].forEach((val, idx) => {
                if (val) {
                    const parsed = extractContactFromAny(val, idx === 0 ? "회장" : (idx === 1 ? "총무" : "이장"));
                    if (parsed && parsed.phone) {
                        newContacts.push(parsed);
                    }
                }
            });

            place.contacts = newContacts;
            saveState();
            renderPlaceList();

            if (modalEditContacts) modalEditContacts.style.display = "none";

            alert(`[${place.name}] 경로당 연락처가 성공적으로 저장되었습니다!`);
        });
    }

    // Save Kakao Key
    document.getElementById("btn-save-kakao-key").addEventListener("click", async () => {
        const inputKey = document.getElementById("input-kakao-js-key").value.trim();
        if (!inputKey) {
            alert("카카오 JavaScript 앱 키를 입력해주세요.");
            return;
        }

        try {
            await loadKakaoSdk(inputKey);
            state.kakaoJsKey = inputKey;
            localStorage.setItem("kakao_js_key", inputKey);

            // Sync with server config file for mobile access
            try {
                await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kakaoJsKey: inputKey })
                });
            } catch (err) {}
            
            initKakaoMap();
            state.activeMapEngine = "kakao";
            updateEngineButtonUI();
            renderPlaceList();

            modalKakaoKey.style.display = "none";
            alert("🟡 카카오 지도 공식 연동이 성공했습니다! 워터마크 없는 카카오 지도로 작동합니다.");
        } catch (e) {
            const currentOrigin = window.location.origin;
            alert(`⚠️ 카카오 지도를 로드할 수 없습니다.\n\n[오류 원인]\n${e.message || e}\n\n[해결 방법]\n1. 카카오 디벨로퍼스(developers.kakao.com) -> 좌측 메뉴 [제품 설정] -> [카카오맵] 클릭\n2. 상단 [활성화 설정] 스위치가 ON으로 켜져 있는지 확인하고 ON으로 켜주세요.\n3. REST API 키가 아닌 3번째 'JavaScript 키' 32자리가 맞는지 확인해주세요.\n4. 현재 접속 주소가 등록되어 있는지 확인:\n👉 ${currentOrigin}\n\n우선 워터마크 없는 깔끔한 기본 지도로 전환됩니다.`);
            
            state.activeMapEngine = "leaflet";
            initLeafletMap();
            updateEngineButtonUI();
            renderPlaceList();
            modalKakaoKey.style.display = "none";
        }
    });

    document.getElementById("btn-use-osm-fallback").addEventListener("click", () => {
        state.activeMapEngine = "leaflet";
        initLeafletMap();
        updateEngineButtonUI();
        renderPlaceList();
        modalKakaoKey.style.display = "none";
    });

    const btnToggle = document.getElementById("btn-toggle-engine");
    if (btnToggle) {
        btnToggle.addEventListener("click", () => {
            if (state.activeMapEngine === "kakao") {
                state.activeMapEngine = "leaflet";
                initLeafletMap();
            } else {
                if (state.kakaoJsKey && window.kakao && window.kakao.maps) {
                    state.activeMapEngine = "kakao";
                    initKakaoMap();
                } else {
                    modalKakaoKey.style.display = "flex";
                    return;
                }
            }
            updateEngineButtonUI();
            renderPlaceList();
        });
    }
    const btnPasteSample = document.getElementById("btn-paste-hadong-sample");
    if (btnPasteSample) {
        btnPasteSample.addEventListener("click", () => {
            const text = generateHadongSampleImportText();
            document.getElementById("paste-input").value = text;
            if (!state.groups.includes("하동교육")) {
                state.groups.push("하동교육");
                saveState();
                renderGroupSelect();
            }
            state.activeGroup = "하동교육";
            renderImportGroupSelect();
            lastParsedText = "";
            updateColumnMappingUI();
        });
    }

    const btnLoadSample = document.getElementById("btn-load-hadong-sample");
    if (btnLoadSample) {
        btnLoadSample.addEventListener("click", () => {
            loadDefaultHadongPlaces();
            state.activeGroup = "하동교육";
            renderGroupSelect();
            renderPlaceList();
        });
    }

    const btnFixRegion = document.getElementById("btn-fix-region-batch");
    if (btnFixRegion) btnFixRegion.addEventListener("click", batchFixRegionPrefixes);

    const btnClearAll = document.getElementById("btn-clear-all");
    if (btnClearAll) {
        btnClearAll.addEventListener("click", () => {
            if (!state.activeGroup) {
                alert("📁 먼저 삭제할 경로당 폴더를 선택해 주세요.");
                return;
            }
            if (confirm(`[${state.activeGroup}] 폴더의 경로당 데이터를 모두 삭제하시겠습니까?`)) {
                state.places = state.places.filter(p => p.group !== state.activeGroup);
                saveState();
                renderPlaceList();
            }
        });
    }

    document.getElementById("btn-export-excel").addEventListener("click", exportToExcel);
    const btnFit = document.getElementById("btn-fit-bounds");
    if (btnFit) btnFit.addEventListener("click", fitMapBounds);
    const btnMyLoc = document.getElementById("btn-my-location");
    if (btnMyLoc) btnMyLoc.addEventListener("click", getMyLocation);
    const btnProcessImport = document.getElementById("btn-process-import");
    if (btnProcessImport) btnProcessImport.addEventListener("click", processImportData);
    initImportMappingEvents();

    // Global delegated listener for popup status selection
    document.addEventListener("change", (e) => {
        if (e.target && e.target.classList.contains("popup-status-select")) {
            if (state.activeMapEngine !== "kakao") {
                const placeId = e.target.dataset.id;
                const place = state.places.find(p => p.id === placeId);
                if (place) {
                    const newStatusId = e.target.value;
                    place.status = newStatusId;
                    const newStatusObj = getStatusObj(newStatusId);
                    e.target.style.background = newStatusObj.color;
                    saveState();
                    renderStatusSummaryChips();
                    renderPlaceListUIOnly();
                    renderLeafletMarkers(getFilteredPlaces(), false);
                }
            }
        }
    });
}

function updateEngineButtonUI() {
    const textSpan = document.getElementById("engine-btn-text");
    if (textSpan) {
        if (state.activeMapEngine === "kakao") {
            textSpan.textContent = "🟡 카카오 지도 사용 중";
        } else {
            textSpan.textContent = "🌐 오픈스트리트맵 사용 중";
        }
    }
}

/* ----------------------------------------------------
   3. Render UI & Place List
---------------------------------------------------- */
function renderGroupSelect() {
    if (!state.activeGroup || !state.groups.includes(state.activeGroup)) {
        state.activeGroup = "";
    }
    const select = document.getElementById("group-select");
    select.innerHTML = `
        <option value="" ${state.activeGroup === "" ? "selected" : ""}>📁 경로당 폴더를 선택해주세요</option>
    `;
    
    state.groups.forEach(group => {
        const opt = document.createElement("option");
        opt.value = group;
        opt.textContent = `📁 ${group}`;
        if (group === state.activeGroup) opt.selected = true;
        select.appendChild(opt);
    });
}

function renderImportGroupSelect() {
    const select = document.getElementById("import-group-select");
    if (!select) return;

    const chkHasHeader = document.getElementById("chk-has-header-row");
    if (chkHasHeader) {
        chkHasHeader.checked = false;
    }

    select.innerHTML = `
        <option value="" ${!state.activeGroup ? "selected" : ""}>📁 경로당 폴더를 선택해주세요</option>
    `;

    state.groups.forEach(group => {
        const opt = document.createElement("option");
        opt.value = group;
        opt.textContent = `📁 ${group}`;
        if (group === state.activeGroup) opt.selected = true;
        select.appendChild(opt);
    });

    const newOpt = document.createElement("option");
    newOpt.value = "__new__";
    newOpt.textContent = "➕ [새 폴더 새로 만들기...]";
    select.appendChild(newOpt);
}

function handleCreateNewImportGroup() {
    const input = prompt("새로 생성할 경로당 폴더 이름을 입력하세요:", "새 경로당 그룹");
    if (input && input.trim()) {
        const groupName = input.trim();
        if (!state.groups.includes(groupName)) {
            state.groups.push(groupName);
            saveState();
            renderGroupSelect();
        }
        state.activeGroup = groupName;
        renderImportGroupSelect();
        const select = document.getElementById("import-group-select");
        if (select) select.value = groupName;

        // Clean slate for new folder
        const pasteInput = document.getElementById("paste-input");
        if (pasteInput) {
            pasteInput.value = "";
            lastParsedText = "";
            updateColumnMappingUI();
        }
    }
}

function getFilteredPlaces() {
    if (!state.activeGroup) {
        return [];
    }
    let groupPlaces = state.places.filter(p => p.group === state.activeGroup && !isHeaderRow(p.name, p.address));

    // Filter by Sales Rep if selected
    if (state.activeSalesRep !== "all") {
        if (state.activeSalesRep === "__unassigned__") {
            groupPlaces = groupPlaces.filter(p => !p.salesRep);
        } else {
            const targetRep = state.salesReps.find(r => r.id === state.activeSalesRep || r.name === state.activeSalesRep);
            const targetName = targetRep ? targetRep.name : state.activeSalesRep;
            groupPlaces = groupPlaces.filter(p => p.salesRep === state.activeSalesRep || p.salesRep === targetName);
        }
    }

    return groupPlaces.filter((p, index) => {
        const placeStatus = normalizePlaceStatus(p.status);
        if (state.activeFilter !== "all" && placeStatus !== state.activeFilter) {
            return false;
        }
        if (state.searchKeyword) {
            const rawKw = state.searchKeyword.trim();
            const kw = rawKw.toLowerCase();

            // 1. Search by Senior Center Name (경로당명)
            const matchName = p.name && p.name.toLowerCase().includes(kw);

            // 2. Search by List Number (번호/순번 e.g., 52, 52번, 52.)
            const listSeqStr = String(index + 1);
            const digitsKw = rawKw.replace(/[^0-9]/g, "");
            const matchNumber = digitsKw.length > 0 && (listSeqStr === digitsKw || listSeqStr.startsWith(digitsKw));

            // 3. Search by Sales Rep Name
            const matchRep = p.salesRep && p.salesRep.toLowerCase().includes(kw);

            if (!matchName && !matchNumber && !matchRep) return false;
        }
        return true;
    });
}

function renderPlaceList(shouldFitBounds = false) {
    renderPlaceListUIOnly();

    const filtered = getFilteredPlaces();
    if (state.activeMapEngine === "kakao" && state.kakaoMap) {
        renderKakaoMarkers(filtered, shouldFitBounds);
    } else {
        renderLeafletMarkers(filtered, shouldFitBounds);
    }
}

function renderPlaceListUIOnly() {
    renderStatusSummaryChips();

    const listEl = document.getElementById("place-list");
    const emptyEl = document.getElementById("empty-state");
    const filtered = getFilteredPlaces();

    if (state.activeGroup === "") {
        document.getElementById("list-footer-info").textContent = "📁 경로당 폴더를 선택해주세요";
    } else {
        document.getElementById("list-footer-info").textContent = `총 ${filtered.length}개 경로당 표시 중`;
    }

    listEl.innerHTML = "";

    if (filtered.length === 0) {
        emptyEl.style.display = "block";
        const emptyTitle = emptyEl.querySelector("p");
        const emptySub = emptyEl.querySelector(".sub");
        if (state.activeGroup === "") {
            if (emptyTitle) emptyTitle.textContent = "📁 경로당 폴더를 선택해 주세요.";
            if (emptySub) emptySub.textContent = "위쪽 드롭다운 메뉴에서 보시고자 하는 폴더(예: 하동교육)를 선택하면 지도가 나타납니다.";
        } else {
            if (emptyTitle) emptyTitle.textContent = "등록된 경로당 정보가 없습니다.";
            if (emptySub) emptySub.textContent = "상단의 [엑셀/텍스트 일괄 등록] 버튼을 눌러 데이터를 추가하세요.";
        }
    } else {
        emptyEl.style.display = "none";

        const groupPlaces = (!state.activeGroup ? [] : state.places.filter(p => p.group === state.activeGroup))
            .filter(p => !isHeaderRow(p.name, p.address));

        filtered.forEach((item) => {
            const card = document.createElement("li");
            card.className = `place-card ${item.id === state.selectedPlaceId ? 'selected' : ''}`;
            
            const curStatusObj = getStatusObj(item.status);
            const statusOptionsHtml = renderStatusOptionsHtml(curStatusObj.id);

            const statusSelectHtml = `
                <select class="status-quick-select" data-id="${item.id}" style="background:${curStatusObj.color}; color:${getContrastTextColor(curStatusObj.color)}; border:none; border-radius:12px; padding:3px 8px; font-size:11px; font-weight:700; cursor:pointer; outline:none; box-shadow:0 1px 3px rgba(0,0,0,0.15);">
                    ${statusOptionsHtml}
                </select>
            `;

            const displayName = sanitizeName(item.name, item.address);
            const naverNavUrl = getTmapNavUrl(item);
            const kakaoNavUrl = `https://map.kakao.com/link/search/${encodeURIComponent(item.address)}`;
            const seqNum = groupPlaces.indexOf(item) + 1;
            const displaySeq = seqNum > 0 ? seqNum : "";

            card.innerHTML = `
                <div class="place-card-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="place-title">${displaySeq ? displaySeq + '. ' : ''}${escapeHtml(displayName)}</span>
                    ${statusSelectHtml}
                </div>
                <div class="place-address">
                    <i class="fa-solid fa-location-dot"></i>
                    <span>${escapeHtml(item.address || "주소 미입력")}</span>
                </div>
                ${renderContactsHtml(getPlaceContacts(item), false, item.id)}
                <div class="place-memo-box">
                    <div class="place-memo-header">
                        <span class="place-memo-title">
                            <i class="fa-solid fa-note-sticky" style="color:#d97706;"></i> 특이사항 / 메모
                        </span>
                        <span class="place-memo-save-indicator" data-memo-status-for="${item.id}"></span>
                    </div>
                    <textarea class="place-memo-textarea" data-id="${item.id}" rows="2" placeholder="방문 특이사항 / 메모 입력...">${escapeHtml(item.memo || "")}</textarea>
                </div>
                <div class="place-actions">
                    <a href="${naverNavUrl}" class="action-link tmap-nav">
                        <i class="fa-solid fa-diamond-turn-right"></i> 티맵 길찾기
                    </a>
                    <a href="${kakaoNavUrl}" target="_blank" class="action-link">
                        <i class="fa-solid fa-map"></i> 카카오맵
                    </a>
                    <button class="action-link btn-edit-place" data-id="${item.id}" style="border:none; cursor:pointer;">
                        <i class="fa-solid fa-pen-to-square"></i> 정보 수정
                    </button>
                    <button class="action-link btn-delete-place" data-id="${item.id}" style="border:none; cursor:pointer; color:#ef4444;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;

            card.addEventListener("click", (e) => {
                if (e.target.closest(".action-link") || e.target.closest("button") || e.target.closest(".status-quick-select") || e.target.closest(".place-memo-box")) return;
                selectPlace(item.id);
            });

            const statusSelect = card.querySelector(".status-quick-select");
            if (statusSelect) {
                statusSelect.addEventListener("change", (e) => {
                    e.stopPropagation();
                    updatePlaceStatus(item.id, e.target.value);
                });
            }

            const memoTextarea = card.querySelector(".place-memo-textarea");
            if (memoTextarea) {
                let memoTimer = null;
                memoTextarea.addEventListener("click", (e) => e.stopPropagation());
                memoTextarea.addEventListener("input", (e) => {
                    e.stopPropagation();
                    const indicator = card.querySelector(`[data-memo-status-for="${item.id}"]`);
                    if (indicator) indicator.textContent = "저장 중...";
                    clearTimeout(memoTimer);
                    memoTimer = setTimeout(() => {
                        updatePlaceMemo(item.id, e.target.value, false);
                        if (indicator) {
                            indicator.textContent = "✓ 저장됨";
                            setTimeout(() => { if (indicator) indicator.textContent = ""; }, 2000);
                        }
                    }, 600);
                });
                memoTextarea.addEventListener("blur", (e) => {
                    clearTimeout(memoTimer);
                    updatePlaceMemo(item.id, e.target.value, false);
                    const indicator = card.querySelector(`[data-memo-status-for="${item.id}"]`);
                    if (indicator) {
                        indicator.textContent = "✓ 저장됨";
                        setTimeout(() => { if (indicator) indicator.textContent = ""; }, 2000);
                    }
                });
            }

            const btnSaveMemo = card.querySelector(".btn-save-place-memo");
            if (btnSaveMemo) {
                btnSaveMemo.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const ta = card.querySelector(".place-memo-textarea");
                    if (!ta) return;
                    updatePlaceMemo(item.id, ta.value.trim(), true);
                    const indicator = card.querySelector(`[data-memo-status-for="${item.id}"]`);
                    if (indicator) {
                        indicator.textContent = "✓ 저장됨";
                        setTimeout(() => { if (indicator) indicator.textContent = ""; }, 2500);
                    }
                    btnSaveMemo.classList.add("saved");
                    btnSaveMemo.innerHTML = '<i class="fa-solid fa-check"></i> 저장됨';
                    setTimeout(() => {
                        btnSaveMemo.classList.remove("saved");
                        btnSaveMemo.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> 메모 저장';
                    }, 2000);
                });
            }

            const btnEdit = card.querySelector(".btn-edit-place") || card.querySelector(".btn-edit-address");
            if (btnEdit) {
                btnEdit.addEventListener("click", (e) => {
                    e.stopPropagation();
                    openPlaceEditModal(item.id);
                });
            }

            card.querySelector(".btn-delete-place").addEventListener("click", (e) => {
                e.stopPropagation();
                deletePlace(item.id);
            });

            listEl.appendChild(card);
        });
    }
}

function movePlaceInGroup(placeId, direction) {
    const groupPlaces = state.places.filter(p => p.group === state.activeGroup);
    const idxInGroup = groupPlaces.findIndex(p => p.id === placeId);
    if (idxInGroup === -1) return;

    const targetIdxInGroup = idxInGroup + direction;
    if (targetIdxInGroup < 0 || targetIdxInGroup >= groupPlaces.length) return;

    const placeA = groupPlaces[idxInGroup];
    const placeB = groupPlaces[targetIdxInGroup];

    const globalIdxA = state.places.indexOf(placeA);
    const globalIdxB = state.places.indexOf(placeB);

    if (globalIdxA !== -1 && globalIdxB !== -1) {
        state.places[globalIdxA] = placeB;
        state.places[globalIdxB] = placeA;
        saveState();
        renderPlaceList();
    }
}

function isMobileDevice() {
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function updateKakaoPopupContent(place, popupEl) {
    if (!place || !popupEl) return;
    if (place._kakaoCluster && place._kakaoCluster.places && place._kakaoCluster.places.length > 1) {
        // Multi-building popup: update each item in the cluster
        place._kakaoCluster.places.forEach(p => {
            const pStatusObj = getStatusObj(p.status);
            const select = popupEl.querySelector(`.popup-status-select[data-id="${p.id}"]`);
            if (select) {
                select.innerHTML = renderStatusOptionsHtml(pStatusObj.id);
                select.value = pStatusObj.id;
                select.style.background = pStatusObj.color;
                select.style.color = getContrastTextColor(pStatusObj.color);
            }
        });
    } else {
        // Single popup
        const curStatusObj = getStatusObj(place.status);
        const select = popupEl.querySelector(".popup-status-select");
        if (select) {
            select.innerHTML = renderStatusOptionsHtml(curStatusObj.id);
            select.value = curStatusObj.id;
            select.style.background = curStatusObj.color;
            select.style.color = getContrastTextColor(curStatusObj.color);
        }
    }
}

function updatePlaceStatus(placeId, newStatusId) {
    const place = state.places.find(p => p.id === placeId);
    if (!place) return;

    place.status = newStatusId;
    const statusObj = getStatusObj(newStatusId);
    const contrastColor = getContrastTextColor(statusObj.color);

    // 1. Update Kakao Custom Overlay (Pin badge border & number circle)
    if (place._kakaoOverlayContent) {
        const isMulti = place._kakaoCluster && place._kakaoCluster.places && place._kakaoCluster.places.length > 1;
        if (!isMulti) {
            const pinBadge = place._kakaoOverlayContent.querySelector(".custom-pin-badge");
            const pinNum = place._kakaoOverlayContent.querySelector(".pin-number");
            if (pinBadge) pinBadge.style.borderColor = statusObj.color;
            if (pinNum) {
                pinNum.style.background = statusObj.color;
                pinNum.style.color = contrastColor;
            }
        }
    }

    // 2. Update Kakao Popup Select if mounted
    if (place._kakaoPopupEl) {
        const popupSelect = place._kakaoPopupEl.querySelector(`.popup-status-select[data-id="${placeId}"]`) || place._kakaoPopupEl.querySelector(".popup-status-select");
        if (popupSelect) {
            popupSelect.value = newStatusId;
            popupSelect.style.background = statusObj.color;
            popupSelect.style.color = contrastColor;
        }
    }

    // 3. Update Leaflet Marker if active
    if (state.leafletMarkers && state.leafletMarkers[placeId]) {
        const marker = state.leafletMarkers[placeId];
        const isMulti = place._kakaoCluster && place._kakaoCluster.places && place._kakaoCluster.places.length > 1;
        
        if (!isMulti) {
            const groupPlaces = (!state.activeGroup ? [] : state.places.filter(p => p.group === state.activeGroup))
                .filter(p => !isHeaderRow(p.name, p.address));
            const seqNum = groupPlaces.indexOf(place) + 1;
            const displaySeq = seqNum > 0 ? seqNum : "";
            const displayName = sanitizeName(place.name, place.address);

            const newIcon = L.divIcon({
                className: "custom-div-icon",
                html: `
                    <div class="custom-pin-badge" style="border-color: ${statusObj.color};">
                        <span class="pin-number" style="background: ${statusObj.color}; color: ${contrastColor};">${displaySeq}</span>
                        <span class="pin-label">${escapeHtml(displayName)}</span>
                    </div>
                `,
                iconSize: [110, 24],
                iconAnchor: [12, 24],
                popupAnchor: [0, -24]
            });
            const updatedIcon = L.divIcon({
                className: "custom-div-icon",
                html: buildPinBadgeHtml([place], groupPlaces),
                iconSize: state.pinDisplayMode !== "number_name" ? [28, 24] : [110, 24],
                iconAnchor: [12, 24],
                popupAnchor: [0, -24]
            });
            marker.setIcon(updatedIcon);
        }

        const popup = marker.getPopup();
        if (popup) {
            const popupNode = popup.getElement();
            if (popupNode) {
                const selectEl = popupNode.querySelector(`.popup-status-select[data-id="${placeId}"]`) || popupNode.querySelector(".popup-status-select");
                if (selectEl) {
                    selectEl.value = newStatusId;
                    selectEl.style.background = statusObj.color;
                    selectEl.style.color = contrastColor;
                }
            }
        }
    }

    // 4. Update Sidebar Place Card dropdown & background
    const listEl = document.getElementById("place-list");
    if (listEl) {
        const selectEl = listEl.querySelector(`.status-quick-select[data-id="${placeId}"]`);
        if (selectEl) {
            selectEl.value = newStatusId;
            selectEl.style.background = statusObj.color;
            selectEl.style.color = contrastColor;
        }
    }

    // 5. Update Status Summary Chips count
    renderStatusSummaryChips();

    // 6. Save persistent state
    saveState();

    // 7. If active filter is not 'all', re-render to only show places matching the active filter
    if (state.activeFilter && state.activeFilter !== "all") {
        renderPlaceList();
    }
}

function updatePlaceMemo(placeId, memoText, syncUI = true) {
    const place = state.places.find(p => p.id === placeId);
    if (!place) return;

    place.memo = memoText;

    // Sync other instances of memo textareas without losing active focus
    if (syncUI) {
        document.querySelectorAll(`.place-memo-textarea[data-id="${placeId}"], .popup-memo-textarea[data-id="${placeId}"]`).forEach(el => {
            if (el !== document.activeElement && el.value !== memoText) {
                el.value = memoText;
            }
        });
    }

    saveState();
}

function selectPlace(placeId) {
    state.selectedPlaceId = placeId;
    renderPlaceListUIOnly();

    const place = state.places.find(p => p.id === placeId);
    if (!place) return;

    if (state.activeMapEngine === "kakao" && state.kakaoMap) {
        // Hide all open popup windows
        state.places.forEach(p => {
            if (p._kakaoPopup && p._kakaoPopup.setMap) {
                p._kakaoPopup.setMap(null);
            }
        });
        state.kakaoInfoWindows.forEach(p => {
            if (p && p.setMap) p.setMap(null);
            else if (p && p.close) p.close();
        });

        // Ensure popup content options and colors are dynamically updated
        if (place._kakaoPopupEl) {
            updateKakaoPopupContent(place, place._kakaoPopupEl);
        }

        // Open popup for selected place
        if (place._kakaoPopup) {
            place._kakaoPopup.setMap(state.kakaoMap);
        }

        // Pan map smoothly to center the senior center and popup without changing zoom level (works on both PC Web & Mobile)
        if (place.lat && place.lng) {
            const pos = new kakao.maps.LatLng(place.lat, place.lng);
            const projection = state.kakaoMap.getProjection();
            const yOffset = isMobileDevice() ? 85 : 70;
            if (projection && projection.pointFromCoords && projection.coordsFromPoint) {
                const point = projection.pointFromCoords(pos);
                // Shift map center north of the pin so the popup is completely visible and dead-centered
                const targetPoint = new kakao.maps.Point(point.x, point.y - yOffset);
                const targetPos = projection.coordsFromPoint(targetPoint);
                state.kakaoMap.panTo(targetPos);
            } else {
                // Fallback latitude shift north
                const latShift = isMobileDevice() ? 0.0024 : 0.0018;
                const targetPos = new kakao.maps.LatLng(place.lat + latShift, place.lng);
                state.kakaoMap.panTo(targetPos);
            }
        }

    } else if (state.leafletMap) {
        if (state.leafletMarkers[placeId]) {
            state.leafletMarkers[placeId].openPopup();
        }
        if (place.lat && place.lng) {
            const yOffset = isMobileDevice() ? 115 : 95;
            const point = state.leafletMap.latLngToContainerPoint([place.lat, place.lng]);
            const targetPoint = L.point(point.x, point.y - yOffset);
            const targetPos = state.leafletMap.containerPointToLatLng(targetPoint);
            state.leafletMap.panTo(targetPos);
        }
    }

    // Scroll selected place card smoothly to the top of the sidebar list
    setTimeout(() => {
        const listWrapper = document.querySelector(".place-list-wrapper");
        const listEl = document.getElementById("place-list");
        if (listEl) {
            const selectedCard = listEl.querySelector(".place-card.selected");
            if (selectedCard) {
                if (listWrapper) {
                    listWrapper.scrollTo({
                        top: selectedCard.offsetTop - listEl.offsetTop,
                        behavior: "smooth"
                    });
                } else {
                    selectedCard.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            }
        }
    }, 50);
}

function fitMapBounds() {
    const places = getFilteredPlaces();
    if (state.activeMapEngine === "kakao" && state.kakaoMap) {
        const bounds = new kakao.maps.LatLngBounds();
        let count = 0;
        places.forEach(p => {
            if (p.lat && p.lng) {
                bounds.extend(new kakao.maps.LatLng(p.lat, p.lng));
                count++;
            }
        });
        if (count > 0) state.kakaoMap.setBounds(bounds);
    } else if (state.leafletMap) {
        const bounds = places.filter(p => p.lat && p.lng).map(p => [p.lat, p.lng]);
        if (bounds.length > 0) state.leafletMap.fitBounds(bounds, { padding: [50, 50] });
    }
}

function getMyLocation() {
    if (!navigator.geolocation) {
        alert("현재 브라우저에서 GPS 위치 기능을 지원하지 않습니다.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            state.myLocation = { lat, lng };

            if (state.activeMapEngine === "kakao" && state.kakaoMap) {
                const moveLatLon = new kakao.maps.LatLng(lat, lng);
                state.kakaoMap.panTo(moveLatLon);
            } else if (state.activeMapEngine === "leaflet" && state.leafletMap) {
                state.leafletMap.panTo([lat, lng]);
            }

            updateMyLocationMarker();
        },
        (err) => {
            console.warn("GPS Location error:", err);
            alert("⚠️ 현재 GPS 위치를 가져올 수 없습니다. 브라우저의 위치 정보 접근 권한을 허용해 주세요.");
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

function updateMyLocationMarker() {
    if (!state.myLocation || !state.myLocation.lat || !state.myLocation.lng) return;

    const lat = state.myLocation.lat;
    const lng = state.myLocation.lng;

    // Remove previous marker
    if (state.myLocationMarker) {
        if (state.myLocationMarker.overlay && typeof state.myLocationMarker.overlay.setMap === "function") {
            state.myLocationMarker.overlay.setMap(null);
        }
        if (state.myLocationMarker.marker && state.leafletMap) {
            state.leafletMap.removeLayer(state.myLocationMarker.marker);
        }
        state.myLocationMarker = null;
    }

    if (state.activeMapEngine === "kakao" && state.kakaoMap && window.kakao && kakao.maps) {
        const position = new kakao.maps.LatLng(lat, lng);

        const content = document.createElement("div");
        content.className = "my-location-marker-container";
        content.style.cssText = "position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 999; width: 24px; height: 24px;";
        content.innerHTML = `
            <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: rgba(3, 207, 93, 0.25); border: 2px solid #03cf5d; animation: myLocPulse 1.8s infinite ease-out; pointer-events: none;"></div>
            <div style="position: relative; z-index: 2; width: 20px; height: 20px; border-radius: 50%; background: #03cf5d; border: 3px solid #ffffff; box-shadow: 0 3px 10px rgba(3, 207, 93, 0.5); display: flex; align-items: center; justify-content: center;">
                <div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>
            </div>
        `;

        content.addEventListener("click", () => {
            alert("📍 현재 내 GPS 실시간 위치입니다.");
        });

        const overlay = new kakao.maps.CustomOverlay({
            position: position,
            content: content,
            xAnchor: 0.5,
            yAnchor: 0.5,
            zIndex: 999
        });
        overlay.setMap(state.kakaoMap);
        state.myLocationMarker = { overlay: overlay };

    } else if (state.leafletMap) {
        const customIcon = L.divIcon({
            className: "my-location-leaflet-marker",
            html: `
                <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer; width: 24px; height: 24px;">
                    <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: rgba(3, 207, 93, 0.25); border: 2px solid #03cf5d; animation: myLocPulse 1.8s infinite ease-out; pointer-events: none;"></div>
                    <div style="position: relative; z-index: 2; width: 20px; height: 20px; border-radius: 50%; background: #03cf5d; border: 3px solid #ffffff; box-shadow: 0 3px 10px rgba(3, 207, 93, 0.5); display: flex; align-items: center; justify-content: center;">
                        <div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>
                    </div>
                </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(state.leafletMap);
        marker.on("click", () => {
            alert("📍 현재 내 GPS 실시간 위치입니다.");
        });
        state.myLocationMarker = { marker: marker };
    }
}

/* ----------------------------------------------------
   4. Smart Geocoding Engine
---------------------------------------------------- */
async function geocodeAddress(address, name, regionPrefix = "경상남도 하동군") {
    if (!address) return { status: "failed" };

    const defaultStatusId = getDefaultStatusId();

    if (HADONG_GEO_MAP[name]) {
        const k = HADONG_GEO_MAP[name];
        return {
            lat: k.lat,
            lng: k.lng,
            address: k.fullAddr,
            jibunAddress: "",
            status: defaultStatusId
        };
    }

    let cleanAddr = address.replace(/\(.*?\)/g, "").trim();
    const hasRegionHeader = /경상남도|경남|하동군|합천군|창녕군|부산|서울|대구|광주|대전|울산|세종|경기도|강원도|충청|전라|경상/.test(cleanAddr);
    
    let candidateAddresses = [cleanAddr];
    if (!hasRegionHeader && regionPrefix) {
        candidateAddresses.unshift(`${regionPrefix} ${cleanAddr}`);
    }

    for (const testAddr of candidateAddresses) {
        // Kakao Geocoder Service
        if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
            try {
                const kakaoResult = await new Promise(resolve => {
                    const geocoder = new kakao.maps.services.Geocoder();
                    geocoder.addressSearch(testAddr, (result, status) => {
                        if (status === kakao.maps.services.Status.OK && result.length > 0) {
                            resolve(result[0]);
                        } else {
                            resolve(null);
                        }
                    });
                });

                if (kakaoResult) {
                    return {
                        lat: parseFloat(kakaoResult.y),
                        lng: parseFloat(kakaoResult.x),
                        address: kakaoResult.road_address ? kakaoResult.road_address.address_name : kakaoResult.address_name,
                        jibunAddress: kakaoResult.address ? kakaoResult.address.address_name : "",
                        status: defaultStatusId
                    };
                }
            } catch (e) {}
        }

        // Nominatim OpenStreetMap fallback
        try {
            const query = `${testAddr}, 대한민국`;
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
            if (resp.ok) {
                const data = await resp.json();
                if (data && data.length > 0) {
                    return {
                        lat: parseFloat(data[0].lat),
                        lng: parseFloat(data[0].lon),
                        address: testAddr,
                        jibunAddress: "",
                        status: defaultStatusId
                    };
                }
            }
        } catch (e) {}
    }

    if (address.includes("하동") || regionPrefix.includes("하동")) {
        return {
            lat: 35.0682 + (Math.random() - 0.5) * 0.05,
            lng: 127.7511 + (Math.random() - 0.5) * 0.05,
            address: regionPrefix ? `${regionPrefix} ${address}` : address,
            status: defaultStatusId
        };
    }

    return {
        lat: null,
        lng: null,
        address: address,
        status: "failed"
    };
}

async function batchFixRegionPrefixes() {
    const region = prompt("현재 그룹의 모든 주소에 결합할 기본 시/군/구 지역명을 입력하세요:", "경상남도 하동군");
    if (!region || !region.trim()) return;

    const prefix = region.trim();
    let countFixed = 0;

    state.places.forEach(p => {
        if (p.group === state.activeGroup) {
            if (!p.address.startsWith(prefix) && !p.address.startsWith("경상남도") && !p.address.startsWith("경남")) {
                p.address = `${prefix} ${p.address}`;
            }
            if (HADONG_GEO_MAP[p.name]) {
                const k = HADONG_GEO_MAP[p.name];
                p.lat = k.lat;
                p.lng = k.lng;
                p.address = k.fullAddr;
                p.status = "verified";
            } else {
                p.status = "verified";
                if (!p.lat) p.lat = 35.0682 + (Math.random() - 0.5) * 0.05;
                if (!p.lng) p.lng = 127.7511 + (Math.random() - 0.5) * 0.05;
            }
            countFixed++;
        }
    });

    state.places = state.places.filter(p => !isHeaderRow(p.name, p.address));
    saveState();
    renderPlaceList();
    alert(`[${state.activeGroup}] 그룹의 ${countFixed}개 경로당 주소에 '${prefix}'가 추가되었습니다!`);
}

function generatePlacesImportText(places) {
    if (!places || places.length === 0) return "";
    return places.map((p, idx) => {
        const contacts = getPlaceContacts(p) || [];
        const hoejang = contacts.find(c => (c.role || "").includes("회장")) || contacts[0];
        const chongmu = contacts.find(c => (c.role || "").includes("총무")) || (contacts.length > 1 ? contacts[1] : null);
        const jang = contacts.find(c => c !== hoejang && c !== chongmu) || (contacts.length > 2 ? contacts[2] : null);

        const hoejangStr = hoejang ? (hoejang.phone || "") : "";
        const chongmuStr = chongmu ? (chongmu.phone || "") : "";
        const jangStr = jang ? (jang.phone || "") : "";

        return `${idx + 1}\t${p.name || ''}\t${p.address || ''}\t${hoejangStr}\t${chongmuStr}\t${jangStr}`;
    }).join("\n");
}

function generateHadongSampleImportText() {
    const samplePhones = [
        { hoejang: "010-5663-7152", chongmu: "010-4556-8924", jang: "010-3341-8910" },
        { hoejang: "010-4593-9075", chongmu: "010-2083-3551", jang: "" },
        { hoejang: "010-4516-4713", chongmu: "010-9519-2894", jang: "010-7712-4412" },
        { hoejang: "010-9314-0781", chongmu: "010-3521-4020", jang: "" },
        { hoejang: "010-4750-3317", chongmu: "010-2951-3208", jang: "010-8841-9921" },
        { hoejang: "010-6876-8118", chongmu: "", jang: "" },
        { hoejang: "010-3151-5768", chongmu: "010-8622-4326", jang: "010-1123-5582" }
    ];

    return HADONG_SAMPLE_DATA.map((d, i) => {
        const pInfo = samplePhones[i % samplePhones.length];
        return `${i + 1}\t${d.name}\t${d.address}\t${pInfo.hoejang || ''}\t${pInfo.chongmu || ''}\t${pInfo.jang || ''}`;
    }).join("\n");
}

let importParsedMatrix = [];
let importHeaders = [];

function initImportMappingEvents() {
    const pasteInput = document.getElementById("paste-input");
    const chkHasHeader = document.getElementById("chk-has-header-row");
    
    if (pasteInput) {
        pasteInput.addEventListener("input", updateColumnMappingUI);
        pasteInput.addEventListener("paste", () => setTimeout(updateColumnMappingUI, 100));
    }
    if (chkHasHeader) {
        chkHasHeader.addEventListener("change", updateColumnMappingUI);
    }

    [
        "col-select-seq",
        "col-select-name",
        "col-select-address",
        "col-select-hoejang",
        "col-select-chongmu",
        "col-select-jang",
        "col-label-seq",
        "col-label-name",
        "col-label-address",
        "col-label-hoejang",
        "col-label-chongmu",
        "col-label-jang"
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", updateColumnMappingUI);
            el.addEventListener("change", updateColumnMappingUI);
        }
    });
}

function splitSingleSpaceImportLine(line) {
    let s = String(line || "").trim();
    if (!s) return [];
    let seq = null;
    const seqMatch = s.match(/^(\d{1,4})[\.\)]?\s+(.*)$/);
    if (seqMatch) {
        seq = seqMatch[1];
        s = seqMatch[2].trim();
    }
    const phones = [];
    const phoneRegex = /(?:01[016789][-\s\.]?\d{3,4}[-\s\.]?\d{4}|0\d{1,2}[-\s\.]?\d{3,4}[-\s\.]?\d{4})/g;
    let m;
    let firstPhoneIdx = -1;
    while ((m = phoneRegex.exec(s)) !== null) {
        if (firstPhoneIdx === -1) firstPhoneIdx = m.index;
        phones.push(m[0].trim());
    }
    if (firstPhoneIdx !== -1) {
        s = s.substring(0, firstPhoneIdx).trim();
    }
    let name = s;
    let addr = "";
    const addrStartMatch = s.match(/^(\S+(?:\s+\S+)?)\s+((?:경상남도|경남|부산|서울|대구|인천|광주|대전|울산|세종|경기도|경기|강원|충북|충남|전북|전남|경북|제주|[가-힣]{1,6}(?:시|군|구|읍|면|동|로|길))\s*.*)$/);
    if (addrStartMatch) {
        name = addrStartMatch[1].trim();
        addr = addrStartMatch[2].trim();
    } else {
        const spIdx = s.indexOf(" ");
        if (spIdx > 0) {
            name = s.substring(0, spIdx).trim();
            addr = s.substring(spIdx + 1).trim();
        }
    }
    const result = [];
    if (seq !== null) result.push(seq);
    result.push(name);
    if (addr) result.push(addr);
    phones.forEach(p => result.push(p));
    return result;
}

function parseTextToMatrix(text) {
    if (!text || !text.trim()) return [];
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const matrix = [];
    
    lines.forEach(line => {
        let parts = [];
        if (line.includes("\t")) {
            parts = line.split("\t");
        } else if (line.includes(",")) {
            parts = line.split(",");
        } else {
            parts = line.split(/\s{2,}/);
            if (parts.length === 1 && line.includes(" ")) {
                parts = splitSingleSpaceImportLine(line);
            }
        }
        parts = parts.map(p => p.trim());
        if (parts.length > 0 && parts.some(Boolean)) {
            matrix.push(parts);
        }
    });
    return matrix;
}

let lastParsedText = "";

function updateColumnMappingUI() {
    const pasteInput = document.getElementById("paste-input");
    const mappingSection = document.getElementById("column-mapping-section");
    const chkHasHeader = document.getElementById("chk-has-header-row");
    
    if (!pasteInput || !mappingSection) return;
    
    const text = pasteInput.value;
    const isNewText = (text !== lastParsedText);
    lastParsedText = text;

    importParsedMatrix = parseTextToMatrix(text);
    
    if (importParsedMatrix.length === 0) {
        mappingSection.style.display = "none";
        return;
    }
    
    mappingSection.style.display = "block";
    const hasHeader = chkHasHeader ? chkHasHeader.checked : false;
    
    const maxCols = Math.max(...importParsedMatrix.map(row => row.length));
    
    if (hasHeader && importParsedMatrix[0]) {
        importHeaders = [];
        for (let i = 0; i < maxCols; i++) {
            importHeaders.push(importParsedMatrix[0][i] || `열 ${i + 1}`);
        }
    } else {
        importHeaders = [];
        for (let i = 0; i < maxCols; i++) {
            importHeaders.push(`열 ${i + 1}`);
        }
    }
    
    const selectIds = [
        "col-select-seq",
        "col-select-name",
        "col-select-address",
        "col-select-hoejang",
        "col-select-chongmu",
        "col-select-jang"
    ];

    const sampleRow = hasHeader ? (importParsedMatrix[1] || []) : (importParsedMatrix[0] || []);

    selectIds.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const curVal = select.value;
        select.innerHTML = '<option value="-1">-- 선택 안 함 --</option>';
        importHeaders.forEach((h, idx) => {
            const opt = document.createElement("option");
            opt.value = idx;
            const rawVal = sampleRow[idx] ? String(sampleRow[idx]).trim() : "";
            const displayVal = rawVal.length > 25 ? rawVal.substring(0, 25) + "..." : rawVal;

            if (hasHeader) {
                opt.textContent = displayVal ? `[열 ${idx + 1}] ${h} (${displayVal})` : `[열 ${idx + 1}] ${h}`;
            } else {
                opt.textContent = displayVal ? `[열 ${idx + 1}] ${displayVal}` : `[열 ${idx + 1}]`;
            }
            select.appendChild(opt);
        });

        // Preserve previous user selection (including "-1" -- 선택 안 함 --)
        if (!isNewText && curVal !== null && curVal !== undefined && curVal !== "" && parseInt(curVal) < importHeaders.length) {
            select.value = curVal;
        } else {
            select.value = "-1";
        }
    });
    
    // Auto-detection & fallback mapping run ONLY on initial paste of new text
    if (isNewText) {
        const selSeq = document.getElementById("col-select-seq");
        const selName = document.getElementById("col-select-name");
        const selAddr = document.getElementById("col-select-address");
        const selHoejang = document.getElementById("col-select-hoejang");
        const selChongmu = document.getElementById("col-select-chongmu");
        const selJang = document.getElementById("col-select-jang");

        // Intelligent column assignment based on number of columns & content patterns:
        // Case A: With Header row
        if (hasHeader && importHeaders.length > 0) {
            importHeaders.forEach((h, idx) => {
                const txt = (h || "").toLowerCase();
                if (txt.match(/순서|연번|순번|no|num/i) && selSeq && selSeq.value === "-1") {
                    selSeq.value = idx;
                }
                if (txt.match(/경로당명|경로당이름|경로당명칭|경로당|시설명|이름|명칭/i) && selName && selName.value === "-1") {
                    selName.value = idx;
                }
                if (txt.match(/도로명주소|지번주소|주소|소재지|위치/i) && selAddr && selAddr.value === "-1") {
                    selAddr.value = idx;
                }
                if (txt.match(/회장/i) && selHoejang && selHoejang.value === "-1") {
                    selHoejang.value = idx;
                }
                if (txt.match(/총무/i) && selChongmu && selChongmu.value === "-1") {
                    selChongmu.value = idx;
                }
                if (txt.match(/이장|사무장|부회장|기타/i) && selJang && selJang.value === "-1") {
                    selJang.value = idx;
                }
            });
        }

        // Case B: No header or unassigned columns:
        // Analyze sampleRow to determine if col 0 is a sequence number (1, 2, 3...) or place name
        const firstColVal = sampleRow[0] ? String(sampleRow[0]).trim() : "";
        const isFirstColSequence = /^\d{1,4}$/.test(firstColVal);

        if (isFirstColSequence) {
            // Format: [1. 순번, 2. 경로당명, 3. 경로당 주소, 4. 회장, 5. 총무, 6. 이장/기타]
            if (selSeq && selSeq.value === "-1" && maxCols >= 1) selSeq.value = 0;
            if (selName && selName.value === "-1" && maxCols >= 2) selName.value = 1;
            if (selAddr && selAddr.value === "-1" && maxCols >= 3) selAddr.value = 2;
            if (selHoejang && selHoejang.value === "-1" && maxCols >= 4) selHoejang.value = 3;
            if (selChongmu && selChongmu.value === "-1" && maxCols >= 5) selChongmu.value = 4;
            if (selJang && selJang.value === "-1" && maxCols >= 6) selJang.value = 5;
        } else {
            // Format without sequence: [1. 경로당명, 2. 경로당 주소, 3. 회장, 4. 총무, 5. 이장/기타]
            if (selSeq && selSeq.value === "-1") selSeq.value = -1; // No sequence column!
            if (selName && selName.value === "-1" && maxCols >= 1) selName.value = 0;
            if (selAddr && selAddr.value === "-1" && maxCols >= 2) selAddr.value = 1;
            if (selHoejang && selHoejang.value === "-1" && maxCols >= 3) selHoejang.value = 2;
            if (selChongmu && selChongmu.value === "-1") {
                selChongmu.value = (maxCols >= 4) ? 3 : -1;
            }
            if (selJang && selJang.value === "-1") {
                selJang.value = (maxCols >= 5) ? 4 : -1;
            }
        }
    }

    renderPreviewTable();
}

function renderPreviewTable() {
    const previewTable = document.getElementById("preview-table");
    if (!previewTable) return;
    
    const thead = previewTable.querySelector("thead");
    const tbody = previewTable.querySelector("tbody");
    thead.innerHTML = "";
    tbody.innerHTML = "";
    
    if (!importParsedMatrix || importParsedMatrix.length === 0) return;
    
    const chkHasHeader = document.getElementById("chk-has-header-row");
    const hasHeader = chkHasHeader ? chkHasHeader.checked : false;
    
    const trHead = document.createElement("tr");
    importHeaders.forEach((h, idx) => {
        const th = document.createElement("th");
        th.textContent = h || `열 ${idx + 1}`;
        trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    
    const sampleRows = hasHeader ? importParsedMatrix.slice(1, 6) : importParsedMatrix.slice(0, 5);
    sampleRows.forEach(row => {
        const tr = document.createElement("tr");
        importHeaders.forEach((_, idx) => {
            const td = document.createElement("td");
            td.textContent = row[idx] || "";
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

async function processImportData() {
    const importSelect = document.getElementById("import-group-select");
    let groupNameInput = importSelect ? importSelect.value : "";

    if (groupNameInput === "__new__" || !groupNameInput) {
        const input = prompt("저장할 경로당 폴더 이름을 입력하세요:", "새 경로당 그룹");
        if (input === null) {
            return;
        }
        if (input && input.trim()) {
            groupNameInput = input.trim();
        } else {
            groupNameInput = "새 경로당 그룹";
        }
    }

    if (!state.groups.includes(groupNameInput)) {
        state.groups.push(groupNameInput);
        saveState();
        renderGroupSelect();
    }
    state.activeGroup = groupNameInput;

    const pasteInput = document.getElementById("paste-input");
    const text = pasteInput ? pasteInput.value : "";
    if (!text.trim()) {
        alert("붙여넣은 텍스트 내용이 없습니다. 경로당 이름과 주소를 상자에 입력하거나 붙여넣어 주세요.");
        return;
    }

    if (!importParsedMatrix || importParsedMatrix.length === 0) {
        importParsedMatrix = parseTextToMatrix(text);
    }

    const selName = document.getElementById("col-select-name");
    const selAddr = document.getElementById("col-select-address");
    const selHoejang = document.getElementById("col-select-hoejang");
    const selChongmu = document.getElementById("col-select-chongmu");
    const selJang = document.getElementById("col-select-jang");

    const nameColIdx = selName ? parseInt(selName.value) : -1;
    const addrColIdx = selAddr ? parseInt(selAddr.value) : -1;
    const hoejangColIdx = selHoejang ? parseInt(selHoejang.value) : -1;
    const chongmuColIdx = selChongmu ? parseInt(selChongmu.value) : -1;
    const jangColIdx = selJang ? parseInt(selJang.value) : -1;

    const labelName = (document.getElementById("col-label-name")?.value || "경로당명").trim();
    const labelAddr = (document.getElementById("col-label-address")?.value || "경로당 주소").trim();

    if (nameColIdx === -1 || addrColIdx === -1) {
        alert(`⚠️ [2. ${labelName}]과 [3. ${labelAddr}] 컬럼은 반드시 선택하셔야 합니다.`);
        return;
    }

    const chkHasHeader = document.getElementById("chk-has-header-row");
    const hasHeader = chkHasHeader ? chkHasHeader.checked : false;

    const rowsToProcess = hasHeader ? importParsedMatrix.slice(1) : importParsedMatrix;

    if (rowsToProcess.length === 0) {
        alert("파싱된 데이터 행이 없습니다. 엑셀 데이터를 확인해 주세요.");
        return;
    }

    const progressContainer = document.getElementById("geocode-progress-container");
    const progressText = document.getElementById("progress-status-text");
    const progressFill = document.getElementById("progress-bar-fill");
    const progressPct = document.getElementById("progress-percentage");

    if (progressContainer) progressContainer.style.display = "block";

    const labelHoejang = (document.getElementById("col-label-hoejang")?.value || "회장").trim();
    const labelChongmu = (document.getElementById("col-label-chongmu")?.value || "총무").trim();
    const labelJang = (document.getElementById("col-label-jang")?.value || "이장/사무장").trim();

    state.isImportingOrSaving = true;
    const newPlaces = [];
    const total = rowsToProcess.length;

    for (let i = 0; i < total; i++) {
        const row = rowsToProcess[i];
        const rawName = (row[nameColIdx] || "").trim();
        const rawAddr = (row[addrColIdx] || "").trim();

        if (!rawName || !rawAddr || isHeaderRow(rawName, rawAddr)) continue;

        const pct = Math.round(((i + 1) / total) * 100);
        if (progressText) progressText.textContent = `주소 변환 중 (${i + 1}/${total}): ${rawName}`;
        if (progressFill) progressFill.style.width = `${pct}%`;
        if (progressPct) progressPct.textContent = `${pct}%`;

        // Extract contacts from mapped columns using custom role titles
        const contacts = [];
        if (hoejangColIdx !== -1 && row[hoejangColIdx]) {
            const c = extractContactFromAny(row[hoejangColIdx], labelHoejang || "회장");
            if (c && c.phone) contacts.push(c);
        }
        if (chongmuColIdx !== -1 && row[chongmuColIdx]) {
            const c = extractContactFromAny(row[chongmuColIdx], labelChongmu || "총무");
            if (c && c.phone) contacts.push(c);
        }
        if (jangColIdx !== -1 && row[jangColIdx]) {
            const c = extractContactFromAny(row[jangColIdx], labelJang || "이장/사무장");
            if (c && c.phone) contacts.push(c);
        }

        // Check if this place already exists in current state to preserve coordinates, status, and memo!
        const normName = String(rawName).trim().replace(/\s+/g, "").toLowerCase();
        const normAddr = String(rawAddr).trim().replace(/\s+/g, "").toLowerCase();
        const existingPlace = state.places.find(p => {
            if (!p) return false;
            const pNormName = String(p.name || "").trim().replace(/\s+/g, "").toLowerCase();
            const pNormAddr = String(p.address || "").trim().replace(/\s+/g, "").toLowerCase();
            return p.group === groupNameInput && ((pNormName === normName && pNormAddr === normAddr) || pNormName === normName);
        });

        const coordDonor = existingPlace || state.places.find(p => p && p.lat && p.lng && (String(p.address || "").trim().replace(/\s+/g, "").toLowerCase() === normAddr || (String(p.name || "").trim().replace(/\s+/g, "").toLowerCase() === normName && String(p.address || "").trim().replace(/\s+/g, "").toLowerCase().includes(normAddr))));
        let lat = existingPlace?.lat || coordDonor?.lat;
        let lng = existingPlace?.lng || coordDonor?.lng;
        let jibunAddress = existingPlace?.jibunAddress || coordDonor?.jibunAddress || "";
        let finalAddr = existingPlace?.address || coordDonor?.address || rawAddr;
        let placeStatus = existingPlace ? normalizePlaceStatus(existingPlace.status) : getDefaultStatusId();
        let placeMemo = existingPlace?.memo || "";

        // If coordinates not already present or address changed, geocode
        if (!lat || !lng || (existingPlace && existingPlace.address !== rawAddr)) {
            const inferredRegion = /창원/.test(groupNameInput) ? "경상남도 창원시" : (/거제/.test(groupNameInput) ? "경상남도 거제시" : (/하동/.test(groupNameInput) ? "경상남도 하동군" : ""));
            const geocodeRes = await geocodeAddress(rawAddr, rawName, inferredRegion);
            lat = geocodeRes.lat;
            lng = geocodeRes.lng;
            jibunAddress = geocodeRes.jibunAddress || "";
            finalAddr = geocodeRes.address || rawAddr;
            if (geocodeRes.status) {
                placeStatus = normalizePlaceStatus(geocodeRes.status);
            }
            await new Promise(r => setTimeout(r, 40));
        }

        newPlaces.push({
            id: existingPlace?.id || `place-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
            name: rawName,
            address: finalAddr,
            jibunAddress: jibunAddress,
            lat: lat,
            lng: lng,
            status: normalizePlaceStatus(placeStatus),
            memo: placeMemo,
            group: groupNameInput,
            contacts: contacts
        });
    }

    // Overwrite: remove existing places in this group and replace with newly imported/updated places!
    const otherGroupPlaces = state.places.filter(p => p.group !== groupNameInput && !isHeaderRow(p.name, p.address));
    const combinedPlaces = [...otherGroupPlaces, ...newPlaces];
    const deduplicatedCombined = deduplicatePlaces(combinedPlaces);

    if (newPlaces.length === 0) {
        state.isImportingOrSaving = false;
        if (progressContainer) progressContainer.style.display = "none";
        alert("⚠️ 입력된 데이터에서 유효한 경로당명과 주소를 찾지 못했습니다. 열(컬럼) 매핑을 확인해 주세요.");
        return;
    }

    state.places = deduplicatedCombined;
    try {
        await saveState("import");
    } finally {
        state.isImportingOrSaving = false;
    }
    renderGroupSelect();
    renderPlaceList(true);
    saveState();
    renderPlaceList();

    if (progressContainer) progressContainer.style.display = "none";
    const modalImport = document.getElementById("modal-import");
    if (modalImport) modalImport.style.display = "none";
    if (pasteInput) pasteInput.value = "";

    const mappingSection = document.getElementById("column-mapping-section");
    if (mappingSection) mappingSection.style.display = "none";

    alert(`성공적으로 ${newPlaces.length}개의 경로당 정보가 [📁 ${groupNameInput}] 폴더에 업데이트(수정/등록)되었습니다!`);
}

function parsePastedText(text) {
    const lines = text.split("\n");
    const rows = [];

    let nameCol = -1;
    let addrCol = -1;
    const contactCols = [];
    let headerFound = false;
    let headerLineIndex = -1;

    for (let i = 0; i < Math.min(lines.length, 3); i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.includes("\t") ? line.split("\t") : (line.includes(",") ? line.split(",") : line.split(/\s{2,}/));
        const cleanParts = parts.map(p => p.trim());

        const isHeaderCandidate = cleanParts.some(p => /경로당\s*명|경로당이름|경로당명칭|도로명주소|지번주소|주소|회장|총무|이장|부회장|부녀회장|연락처|전화|순번|연번|구분/.test(p)) 
                                 && cleanParts.some(p => /주소|연락처|전화|회장|총무|이장|순번|연번|구분/.test(p));

        if (isHeaderCandidate) {
            headerFound = true;
            headerLineIndex = i;
            cleanParts.forEach((p, idx) => {
                if (/경로당\s*명|경로당이름|경로당명칭|시설명/.test(p)) {
                    nameCol = idx;
                } else if (/경로당\s*주소|도로명주소|지번주소|주소/.test(p)) {
                    addrCol = idx;
                } else {
                    let defaultRole = "";
                    if (/이장/.test(p)) defaultRole = "이장";
                    else if (/부회장/.test(p)) defaultRole = "부회장";
                    else if (/회장/.test(p)) defaultRole = "회장";
                    else if (/총무/.test(p)) defaultRole = "총무";
                    else if (/부녀/.test(p)) defaultRole = "부녀회장";
                    else if (/연락처|전화|H\.?P/.test(p)) defaultRole = "연락처";

                    if (defaultRole) {
                        contactCols.push({ colIndex: idx, defaultRole: defaultRole });
                    }
                }
            });

            if (nameCol === -1) {
                cleanParts.forEach((p, idx) => {
                    if (nameCol === -1 && /경로당/.test(p)) nameCol = idx;
                });
            }
            break;
        }
    }

    lines.forEach((line, idx) => {
        let trimmed = line.trim();
        if (!trimmed) return;

        if (headerFound && idx === headerLineIndex) return;
        if (isHeaderRow(trimmed, "")) return;

        trimmed = trimmed.replace(/^\d+[\.\)]\s*/, "");

        let parts = [];
        if (trimmed.includes("\t")) {
            parts = trimmed.split("\t");
        } else if (trimmed.includes(",")) {
            parts = trimmed.split(",");
        } else if (/\s{2,}/.test(trimmed)) {
            parts = trimmed.split(/\s{2,}/);
        } else {
            const spaceIdx = trimmed.search(/\s/);
            if (spaceIdx > 0) {
                parts = [trimmed.slice(0, spaceIdx), trimmed.slice(spaceIdx + 1)];
            } else {
                parts = [trimmed];
            }
        }

        parts = parts.map(p => p.trim()).filter(Boolean);

        let name = "";
        let address = "";
        const contacts = [];

        if (headerFound && nameCol >= 0 && parts[nameCol]) {
            name = parts[nameCol];
            address = addrCol >= 0 && parts[addrCol] ? parts[addrCol] : "";

            contactCols.forEach(colInfo => {
                if (parts[colInfo.colIndex]) {
                    const c = parseContactString(parts[colInfo.colIndex], colInfo.defaultRole);
                    if (c) contacts.push(c);
                }
            });
        } else {
            const nonContactParts = [];
            let contactCount = 0;

            parts.forEach((part) => {
                const defaultRole = contactCount === 0 ? "연락처" : `연락처 ${contactCount + 1}`;
                const parsedContact = parseContactString(part, defaultRole);
                if (parsedContact) {
                    contacts.push(parsedContact);
                    contactCount++;
                } else {
                    nonContactParts.push(part);
                }
            });

            if (nonContactParts.length > 1 && /^\d+$/.test(nonContactParts[0])) {
                nonContactParts.shift();
            }

            if (nonContactParts.length >= 3 && /[동|리|면|읍|구]$/.test(nonContactParts[0])) {
                name = nonContactParts[1];
                address = nonContactParts[2];
            } else if (nonContactParts.length >= 2) {
                name = nonContactParts[0];
                address = nonContactParts[1];
            } else if (nonContactParts.length === 1) {
                name = nonContactParts[0];
                address = nonContactParts[0];
            }
        }

        name = sanitizeName(name, address);

        if (name && !isHeaderRow(name, address)) {
            rows.push({ name, address: address || name, contacts });
        }
    });

    return rows;
}

function openContactsEditModal(placeId) {
    const place = state.places.find(p => p.id === placeId);
    if (!place) return;

    const modal = document.getElementById("modal-edit-contacts");
    if (!modal) return;

    document.getElementById("edit-contacts-place-id").value = place.id;
    const titleEl = document.getElementById("modal-contacts-title");
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-phone-volume"></i> [${escapeHtml(place.name)}] 경로당 연락처 관리`;

    const contacts = getPlaceContacts(place) || [];
    const c1 = contacts[0] ? `${contacts[0].role || ''} ${contacts[0].phone || ''}`.trim() : "";
    const c2 = contacts[1] ? `${contacts[1].role || ''} ${contacts[1].phone || ''}`.trim() : "";
    const c3 = contacts[2] ? `${contacts[2].role || ''} ${contacts[2].phone || ''}`.trim() : "";

    document.getElementById("input-contact-1").value = c1;
    document.getElementById("input-contact-2").value = c2;
    document.getElementById("input-contact-3").value = c3;

    modal.style.display = "flex";
}

function openPlaceEditModal(placeId) {
    const place = state.places.find(p => p.id === placeId);
    if (!place) return;

    state.selectedPlaceId = placeId;

    const modal = document.getElementById("modal-edit-place");
    if (!modal) {
        // Fallback to legacy address edit if modal not found
        openAddressEditModalLegacy(placeId);
        return;
    }

    const modalBody = modal.querySelector(".modal-body");
    if (modalBody) modalBody.scrollTop = 0;

    document.getElementById("edit-place-id").value = place.id;
    document.getElementById("edit-place-name").value = place.name || "";
    document.getElementById("edit-place-address").value = place.address || "";

    const contacts = getPlaceContacts(place) || [];
    const c1 = contacts[0] || { role: "회장", phone: "" };
    const c2 = contacts[1] || { role: "총무", phone: "" };

    const role1El = document.getElementById("edit-contact-role-1");
    const phone1El = document.getElementById("edit-contact-phone-1");
    const role2El = document.getElementById("edit-contact-role-2");
    const phone2El = document.getElementById("edit-contact-phone-2");

    if (role1El) role1El.value = c1.role || "회장";
    if (phone1El) phone1El.value = c1.phone || "";
    if (role2El) role2El.value = c2.role || "총무";
    if (phone2El) phone2El.value = c2.phone || "";

    const statusSelect = document.getElementById("edit-place-status");
    if (statusSelect) {
        statusSelect.innerHTML = renderStatusOptionsHtml(place.status || "unvisited");
    }

    const memoEl = document.getElementById("edit-place-memo");
    if (memoEl) {
        memoEl.value = place.memo || "";
    }

    modal.style.display = "flex";
}

function openAddressEditModalLegacy(placeId) {
    const place = state.places.find(p => p.id === placeId);
    if (!place) return;

    if (typeof daum !== "undefined" && daum.Postcode) {
        new daum.Postcode({
            oncomplete: async function (data) {
                const roadAddr = data.roadAddress;
                const jibunAddr = data.jibunAddress;

                place.address = roadAddr;
                place.jibunAddress = jibunAddr;

                const geo = await geocodeAddress(roadAddr, place.name);
                if (geo.lat && geo.lng) {
                    place.lat = geo.lat;
                    place.lng = geo.lng;
                    place.status = "verified";
                } else {
                    place.status = "needs_check";
                }

                saveState();
                renderPlaceList();
                alert(`[${place.name}] 주소가 정확하게 수정되었습니다!`);
            }
        }).open();
    } else {
        const newAddr = prompt(`[${place.name}] 도로명 또는 지번 주소를 직접 입력하세요:`, place.address);
        if (newAddr) {
            place.address = newAddr.trim();
            saveState();
            renderPlaceList();
        }
    }
}

function deletePlace(placeId) {
    if (confirm("이 경로당을 삭제하시겠습니까?")) {
        state.places = state.places.filter(p => p.id !== placeId);
        saveState();
        renderPlaceList();
    }
}

function exportToExcel() {
    const filtered = getFilteredPlaces();
    if (filtered.length === 0) {
        alert("내보낼 경로당 데이터가 없습니다.");
        return;
    }

    const exportData = filtered.map((p, idx) => {
        const repObj = state.salesReps.find(r => r.id === p.salesRep || r.name === p.salesRep);
        const repName = repObj ? repObj.name : (p.salesRep || "미지정");

        return {
            "번호": idx + 1,
            "경로당명": p.name,
            "도로명주소": p.address,
            "지번주소": p.jibunAddress || "",
            "담당영업사원": repName,
            "위도": p.lat || "",
            "경도": p.lng || "",
            "검증상태": getStatusObj(p.status).label,
            "특이사항/메모": p.memo || "",
            "그룹명": p.group
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "경로당목록");

    const fileName = `경로당_주소목록_${state.activeGroup}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ----------------------------------------------------
   Master Account & Sales Rep & Master Backup Helper Functions
---------------------------------------------------- */
function updateMasterUI() {
    const statusText = document.getElementById("master-status-text");
    const loginBtn = document.getElementById("btn-master-login");
    const loginForm = document.getElementById("master-login-form");
    const loggedInView = document.getElementById("master-logged-in-view");
    const submitBtn = document.getElementById("btn-submit-master-login");
    const logoutBtn = document.getElementById("btn-master-logout");

    if (state.isMaster) {
        if (statusText) statusText.textContent = "👑 마스터 (인증됨)";
        if (loginBtn) {
            loginBtn.style.background = "#10b981";
            loginBtn.style.borderColor = "#059669";
        }
        if (loginForm) loginForm.style.display = "none";
        if (loggedInView) loggedInView.style.display = "block";
        if (submitBtn) submitBtn.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "inline-flex";
    } else {
        if (statusText) statusText.textContent = "👑 마스터 인증";
        if (loginBtn) {
            loginBtn.style.background = "#f59e0b";
            loginBtn.style.borderColor = "#d97706";
        }
        if (loginForm) loginForm.style.display = "block";
        if (loggedInView) loggedInView.style.display = "none";
        if (submitBtn) submitBtn.style.display = "inline-flex";
        if (logoutBtn) logoutBtn.style.display = "none";
    }
}

function renderSalesRepSelects() {
    const filterSelect = document.getElementById("sales-rep-filter-select");
    const assignSelect = document.getElementById("select-assign-sales-rep");

    if (filterSelect) {
        const curVal = state.activeSalesRep;
        filterSelect.innerHTML = `
            <option value="all" ${curVal === "all" ? "selected" : ""}>👤 담당 영업사원 전체 보기</option>
            <option value="__unassigned__" ${curVal === "__unassigned__" ? "selected" : ""}>❓ 미지정 경로당만 보기</option>
        `;
        state.salesReps.forEach(rep => {
            const opt = document.createElement("option");
            opt.value = rep.id || rep.name;
            opt.textContent = `👤 ${rep.name}${rep.memo ? ' (' + rep.memo + ')' : ''}`;
            if (curVal === opt.value) opt.selected = true;
            filterSelect.appendChild(opt);
        });
    }

    if (assignSelect) {
        assignSelect.innerHTML = `<option value="">❌ 미지정 (담당자 없음)</option>`;
        state.salesReps.forEach(rep => {
            const opt = document.createElement("option");
            opt.value = rep.id || rep.name;
            opt.textContent = `👤 ${rep.name}${rep.phone ? ' (' + rep.phone + ')' : ''}`;
            assignSelect.appendChild(opt);
        });
    }

    renderSalesRepListModal();
}

function renderSalesRepListModal() {
    const wrapper = document.getElementById("sales-rep-list-wrapper");
    if (!wrapper) return;

    if (state.salesReps.length === 0) {
        wrapper.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:20px; font-size:12px;">등록된 영업사원이 없습니다. 위 양식에서 추가해 주세요.</div>`;
        return;
    }

    let html = `<div style="display:flex; flex-direction:column; gap:6px;">`;
    state.salesReps.forEach(rep => {
        const telUrl = rep.phone ? `tel:${rep.phone.replace(/[^0-9]/g, '')}` : '#';
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; padding:8px 12px; border-radius:6px; font-size:12px;">
                <div>
                    <span style="font-weight:700; color:#1e293b; font-size:13px;">👤 ${escapeHtml(rep.name)}</span>
                    ${rep.phone ? `<span style="color:#0284c7; margin-left:8px; font-weight:600;"><i class="fa-solid fa-phone"></i> ${escapeHtml(rep.phone)}</span>` : ''}
                    ${rep.memo ? `<div style="color:#64748b; font-size:11px; margin-top:2px;">📌 ${escapeHtml(rep.memo)}</div>` : ''}
                </div>
                <div style="display:flex; gap:6px;">
                    ${rep.phone ? `<a href="${telUrl}" class="btn btn-sm btn-primary" style="background:#03cf5d; border-color:#03cf5d; font-size:11px; padding:3px 8px;"><i class="fa-solid fa-phone"></i> 전화</a>` : ''}
                    <button class="btn btn-sm btn-danger btn-delete-sales-rep" data-id="${rep.id || rep.name}" style="background:#ef4444; border-color:#dc2626; font-size:11px; padding:3px 8px; color:white; border:none; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });
    html += `</div>`;
    wrapper.innerHTML = html;

    wrapper.querySelectorAll(".btn-delete-sales-rep").forEach(btn => {
        btn.addEventListener("click", () => {
            const repId = btn.dataset.id;
            deleteSalesRep(repId);
        });
    });
}

function addSalesRep(name, phone, memo) {
    if (!name || !name.trim()) {
        alert("영업사원 이름을 입력하세요.");
        return;
    }
    const cleanName = name.trim();
    if (state.salesReps.some(r => r.name === cleanName)) {
        alert("이미 같은 이름의 영업사원이 존재합니다.");
        return;
    }

    const newRep = {
        id: `rep-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: cleanName,
        phone: phone ? phone.trim() : "",
        memo: memo ? memo.trim() : ""
    };

    state.salesReps.push(newRep);
    saveState();
    renderSalesRepSelects();
    renderPlaceList();
    alert(`[👤 ${cleanName}] 영업사원이 성공적으로 등록되었습니다!`);
}

function deleteSalesRep(repId) {
    const rep = state.salesReps.find(r => r.id === repId || r.name === repId);
    const repName = rep ? rep.name : repId;

    if (confirm(`[👤 ${repName}] 영업사원을 삭제하시겠습니까?`)) {
        state.salesReps = state.salesReps.filter(r => r.id !== repId && r.name !== repId);
        // Remove assignment from places
        state.places.forEach(p => {
            if (p.salesRep === repId || p.salesRep === repName) {
                delete p.salesRep;
            }
        });
        saveState();
        renderSalesRepSelects();
        renderPlaceList();
    }
}

function openAssignSalesRepModal(placeId) {
    const place = state.places.find(p => p.id === placeId);
    if (!place) return;

    document.getElementById("assign-place-id").value = place.id;
    document.getElementById("assign-place-name").textContent = `👵 [${place.name}] 담당자 설정`;

    renderSalesRepSelects();
    const select = document.getElementById("select-assign-sales-rep");
    if (select) {
        select.value = place.salesRep || "";
    }

    const modal = document.getElementById("modal-assign-sales-rep");
    if (modal) modal.style.display = "flex";
}

function exportMasterBackupJson() {
    const backupObj = {
        appName: "SeniorCenterMapManager",
        version: "2.0_MasterBackup",
        exportedAt: new Date().toISOString(),
        placesCount: state.places.length,
        groupsCount: state.groups.length,
        salesRepsCount: state.salesReps.length,
        customStatusesCount: state.customStatuses.length,
        places: state.places,
        groups: state.groups,
        salesReps: state.salesReps,
        customStatuses: state.customStatuses,
        kakaoJsKey: state.kakaoJsKey,
        masterPin: state.masterPin
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const downloadAnchor = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `경로당지도_마스터데이터_백업_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    alert("💾 마스터 백업 파일(.json) 다운로드가 완료되었습니다!");
}

function importMasterBackupJson(file) {
    if (!file) {
        alert("복원할 마스터 백업 (.json) 파일을 선택하세요.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data || (!Array.isArray(data.places) && !Array.isArray(data.groups))) {
                alert("유효한 마스터 백업 파일 형식이 아닙니다.");
                return;
            }

            if (!confirm(`정말로 마스터 백업 데이터(${data.places ? data.places.length : 0}개 경로당)로 복원하시겠습니까?\n\n※ 현재 저장된 모든 데이터가 백업 파일 시점으로 재구성됩니다.`)) {
                return;
            }

            if (Array.isArray(data.places)) state.places = deduplicatePlaces(data.places);
            if (Array.isArray(data.groups)) state.groups = data.groups;
            if (Array.isArray(data.salesReps)) state.salesReps = data.salesReps;
            if (Array.isArray(data.customStatuses)) state.customStatuses = data.customStatuses;
            if (data.kakaoJsKey) state.kakaoJsKey = data.kakaoJsKey;
            if (data.masterPin) {
                state.masterPin = data.masterPin;
                localStorage.setItem("master_pin", data.masterPin);
            }

            saveState();
            renderGroupSelect();
            renderSalesRepSelects();
            renderStatusSummaryChips();
            renderPlaceList(true);

            const modalBackup = document.getElementById("modal-master-backup");
            if (modalBackup) modalBackup.style.display = "none";

            alert("🎉 마스터 데이터가 성공적으로 100% 복원되었습니다!");
        } catch (err) {
            alert("백업 파일 파싱 중 오류가 발생했습니다: " + err.message);
        }
    };
    reader.readAsText(file);
}

/* ----------------------------------------------------
   Custom Status Management Functions
---------------------------------------------------- */
function getStatusObj(statusId) {
    if (!statusId) {
        return state.customStatuses[0] || { id: "unvisited", label: "미방문", color: "#e53935", icon: "🔴" };
    }
    const found = state.customStatuses.find(s => s.id === statusId || s.label === statusId);
    if (found) return found;

    if (statusId === "unvisited") return state.customStatuses.find(s => s.id === "unvisited") || { id: "unvisited", label: "미방문", color: "#e53935", icon: "🔴" };
    if (statusId === "completed") return state.customStatuses.find(s => s.id === "completed") || { id: "completed", label: "완료", color: "#00c853", icon: "🟢" };
    if (statusId === "contacting") return state.customStatuses.find(s => s.id === "contacting") || { id: "contacting", label: "연락중", color: "#ff6d00", icon: "🟠" };

    return state.customStatuses[0] || { id: "unvisited", label: "미방문", color: "#e53935", icon: "🔴" };
}

function renderStatusSummaryChips() {
    const container = document.getElementById("status-summary-container");
    if (!container) return;

    const groupPlaces = (!state.activeGroup ? [] : state.places.filter(p => p.group === state.activeGroup))
        .filter(p => !isHeaderRow(p.name, p.address));

    const isAllActive = state.activeFilter === 'all';
    const allActiveStyle = isAllActive 
        ? 'background:#0f172a; color:#ffffff !important; font-weight:700;' 
        : 'background:#ffffff; color:#0f172a; border:1px solid #cbd5e1;';
    const allCountStyle = isAllActive 
        ? 'background:rgba(255,255,255,0.25); color:#ffffff;' 
        : 'background:#e2e8f0; color:#0f172a;';

    let html = `
        <div class="summary-chip ${isAllActive ? 'active' : ''}" data-filter="all" style="cursor:pointer; ${allActiveStyle}">
            <span class="chip-label" style="font-weight:inherit; color:inherit;">전체</span>
            <span id="count-total" class="chip-count" style="${allCountStyle}">${groupPlaces.length}</span>
        </div>
    `;

    state.customStatuses.forEach(st => {
        const count = groupPlaces.filter(p => normalizePlaceStatus(p.status) === st.id).length;
        const isActive = state.activeFilter === st.id;
        const activeStyle = isActive 
            ? `border: 2px solid ${st.color}; font-weight:800; background:#ffffff; color:#0f172a !important; box-shadow:0 1px 4px rgba(0,0,0,0.12);` 
            : 'border: 1px solid #cbd5e1; background:#ffffff; color:#0f172a;';

        html += `
            <div class="summary-chip ${isActive ? 'active' : ''}" data-filter="${st.id}" style="cursor:pointer; ${activeStyle}">
                <span class="chip-label" style="display:inline-flex; align-items:center; gap:5px; color:#0f172a !important; font-weight:inherit;">
                    <span style="display:inline-block; width:9px; height:9px; border-radius:50%; background:${st.color}; flex-shrink:0;"></span>
                    ${escapeHtml(st.label)}
                </span>
                <span class="chip-count" style="background:${st.color}; color:#ffffff; font-weight:700;">${count}</span>
            </div>
        `;
    });

    container.innerHTML = html;

    container.querySelectorAll(".summary-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            container.querySelectorAll(".summary-chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            state.activeFilter = chip.dataset.filter;
            renderPlaceList();
        });
    });
}

function renderNewStatusPaletteGrid() {
    const grid = document.getElementById("new-status-palette-grid");
    if (!grid) return;

    grid.innerHTML = PALETTE_20_COLORS.map(p => {
        const isSelected = p.color.toLowerCase() === selectedNewStatusColor.toLowerCase();
        return `
            <button type="button" class="color-swatch-btn ${isSelected ? 'active' : ''}" 
                data-color="${p.color}" 
                data-name="${p.name}" 
                title="${p.name} (${p.color})" 
                style="background-color: ${p.color};">
                ${isSelected ? '<i class="fa-solid fa-check" style="font-size:9px; color:white; text-shadow:0 0 2px rgba(0,0,0,0.8);"></i>' : ''}
            </button>
        `;
    }).join('');

    grid.querySelectorAll(".color-swatch-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const color = btn.dataset.color;
            const name = btn.dataset.name;
            selectedNewStatusColor = color;

            grid.querySelectorAll(".color-swatch-btn").forEach(b => {
                b.classList.remove("active");
                b.innerHTML = "";
            });
            btn.classList.add("active");
            btn.innerHTML = '<i class="fa-solid fa-check" style="font-size:9px; color:white; text-shadow:0 0 2px rgba(0,0,0,0.8);"></i>';

            const preview = document.getElementById("new-status-color-preview");
            if (preview) preview.style.backgroundColor = color;
            const customInput = document.getElementById("new-status-custom-color");
            if (customInput) customInput.value = color;
            const label = document.getElementById("new-status-color-label");
            if (label) {
                label.textContent = `${name} (${color})`;
                label.style.color = color;
            }
        });
    });

    const customInput = document.getElementById("new-status-custom-color");
    if (customInput) {
        customInput.oninput = (e) => {
            const color = e.target.value;
            selectedNewStatusColor = color;
            const preview = document.getElementById("new-status-color-preview");
            if (preview) preview.style.backgroundColor = color;
            const label = document.getElementById("new-status-color-label");
            if (label) {
                label.textContent = `직접선택 (${color})`;
                label.style.color = color;
            }
            grid.querySelectorAll(".color-swatch-btn").forEach(b => {
                b.classList.remove("active");
                b.innerHTML = "";
            });
        };
    }
}

function syncStatusModalInputsSilently() {
    const rows = document.querySelectorAll("#status-items-container .status-item-row");
    if (!rows || rows.length === 0) return;
    let changed = false;
    rows.forEach(row => {
        const id = row.dataset.id;
        const input = row.querySelector(".status-label-input");
        const label = input ? input.value.trim() : "";
        const color = row.dataset.color;
        const st = state.customStatuses.find(s => s.id === id);
        if (st) {
            if (label && st.label !== label) {
                st.label = label;
                changed = true;
            }
            if (color && st.color !== color) {
                st.color = color;
                const matched = PALETTE_20_COLORS.find(p => p.color.toLowerCase() === color.toLowerCase());
                if (matched) st.icon = matched.emoji;
                changed = true;
            }
        }
    });
    if (changed) {
        saveState();
        renderStatusSummaryChips();
        renderPlaceListUIOnly();
    }
}

async function saveCustomStatusSettings() {
    const rows = document.querySelectorAll("#status-items-container .status-item-row");
    if (!rows || rows.length === 0) {
        alert("저장할 상태 항목이 없습니다.");
        return;
    }

    const updated = [];
    let hasEmpty = false;

    rows.forEach(row => {
        const id = row.dataset.id;
        const input = row.querySelector(".status-label-input");
        const label = input ? input.value.trim() : "";
        const color = row.dataset.color || "#3b82f6";

        if (!label) {
            hasEmpty = true;
            return;
        }

        const existing = state.customStatuses.find(s => s.id === id);
        const matchedPalette = PALETTE_20_COLORS.find(p => p.color.toLowerCase() === color.toLowerCase());
        const newEmoji = matchedPalette ? matchedPalette.emoji : (existing ? existing.icon : "🏷️");
        updated.push({
            id: id,
            label: label,
            color: color,
            icon: newEmoji
        });
    });

    if (hasEmpty) {
        alert("상태 명칭이 비어 있는 항목이 있습니다. 모든 항목의 명칭을 입력해 주세요.");
        return;
    }

    if (updated.length === 0) {
        alert("최소 1개 이상의 상태 항목이 필요합니다.");
        return;
    }

    state.customStatuses = updated;
    await saveState();

    const modal = document.getElementById("modal-status-setting");
    if (modal) modal.style.display = "none";

    renderStatusSummaryChips();
    renderPlaceList();

    if (state.selectedPlaceId) {
        selectPlace(state.selectedPlaceId);
    }

    alert("✅ 상태 항목 설정(명칭 및 색상)이 안전하게 저장되었습니다!");
}

function renderStatusSettingModal() {
    const wrapper = document.getElementById("status-items-container");
    if (!wrapper) return;

    // Initialize New Status 20-color grid
    renderNewStatusPaletteGrid();

    if (!state.customStatuses || state.customStatuses.length === 0) {
        wrapper.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:16px; font-size:12px;">등록된 상태 항목이 없습니다.</div>`;
        return;
    }

    let html = ``;
    state.customStatuses.forEach((st, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === state.customStatuses.length - 1;
        const currentColor = st.color || "#3b82f6";

        // Generate 20 swatches for this item's popover
        const swatchesHtml = PALETTE_20_COLORS.map(p => {
            const isSelected = p.color.toLowerCase() === currentColor.toLowerCase();
            return `
                <button type="button" class="color-swatch-btn ${isSelected ? 'active' : ''}" 
                    data-color="${p.color}" 
                    data-name="${p.name}" 
                    title="${p.name} (${p.color})" 
                    style="background-color: ${p.color};">
                    ${isSelected ? '<i class="fa-solid fa-check" style="font-size:9px; color:white; text-shadow:0 0 2px rgba(0,0,0,0.8);"></i>' : ''}
                </button>
            `;
        }).join('');

        html += `
            <div class="status-item-row" data-id="${st.id}" data-color="${currentColor}">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <!-- Move Order Buttons -->
                    <div style="display:flex; align-items:center; gap:3px;">
                        <button type="button" class="btn-move-up-status" data-id="${st.id}" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; width:26px; height:26px; font-size:11px; cursor:pointer; font-weight:800; color:#475569; display:flex; align-items:center; justify-content:center; ${isFirst ? 'opacity:0.3; cursor:not-allowed;' : ''}" ${isFirst ? 'disabled' : ''} title="순서 위로 이동">▲</button>
                        <button type="button" class="btn-move-down-status" data-id="${st.id}" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; width:26px; height:26px; font-size:11px; cursor:pointer; font-weight:800; color:#475569; display:flex; align-items:center; justify-content:center; ${isLast ? 'opacity:0.3; cursor:not-allowed;' : ''}" ${isLast ? 'disabled' : ''} title="순서 아래로 이동">▼</button>
                    </div>

                    <!-- Color Swatch Trigger & Popover -->
                    <div style="position:relative;">
                        <button type="button" class="btn-color-palette-trigger" data-id="${st.id}" style="display:flex; align-items:center; gap:5px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:4px 8px; cursor:pointer; outline:none;" title="20가지 기본 컬러맵에서 색상 선택">
                            <span class="color-preview-circle" style="display:inline-block; width:20px; height:20px; border-radius:50%; background-color:${currentColor}; border:2px solid #ffffff; box-shadow:0 0 0 1px #94a3b8;"></span>
                            <i class="fa-solid fa-chevron-down" style="font-size:9px; color:#64748b;"></i>
                        </button>
                        
                        <!-- 20-Color Map Popover -->
                        <div class="color-palette-popover" id="palette-popover-${st.id}" style="display:none;">
                            <div style="font-size:11.5px; font-weight:700; color:#475569; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                                <span>🎨 20가지 기본 컬러맵</span>
                                <button type="button" class="btn-close-popover" data-id="${st.id}" style="border:none; background:none; cursor:pointer; color:#94a3b8; font-size:12px; font-weight:700;">✕</button>
                            </div>
                            <div class="palette-grid">
                                ${swatchesHtml}
                            </div>
                            <div style="display:flex; align-items:center; justify-content:space-between; border-top:1px solid #f1f5f9; padding-top:8px; margin-top:8px; font-size:11px;">
                                <span style="color:#64748b; font-weight:600;">직접 색상 지정</span>
                                <input type="color" class="custom-color-input" data-id="${st.id}" value="${currentColor}" style="width:26px; height:24px; border:none; background:none; cursor:pointer; padding:0;">
                            </div>
                        </div>
                    </div>

                    <!-- Label Input -->
                    <input type="text" class="status-label-input form-control" data-id="${st.id}" value="${escapeHtml(st.label)}" placeholder="상태 명칭 입력" style="font-size:13.5px; font-weight:700; flex:1; padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1; outline:none; background:#ffffff;">

                    <!-- Delete Button -->
                    <button type="button" class="btn btn-sm btn-delete-status-item" data-id="${st.id}" style="background:#fee2e2; border:1px solid #fca5a5; color:#dc2626; padding:6px 9px; font-size:12px; border-radius:6px; cursor:pointer;" title="상태 항목 삭제">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
    });

    wrapper.innerHTML = html;

    // Up / Down handlers
    wrapper.querySelectorAll(".btn-move-up-status").forEach(btn => {
        btn.addEventListener("click", () => {
            syncStatusModalInputsSilently();
            moveCustomStatus(btn.dataset.id, -1);
        });
    });
    wrapper.querySelectorAll(".btn-move-down-status").forEach(btn => {
        btn.addEventListener("click", () => {
            syncStatusModalInputsSilently();
            moveCustomStatus(btn.dataset.id, 1);
        });
    });

    // Color popover trigger
    wrapper.querySelectorAll(".btn-color-palette-trigger").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const popover = document.getElementById(`palette-popover-${id}`);
            document.querySelectorAll(".color-palette-popover").forEach(p => {
                if (p !== popover) p.style.display = "none";
            });
            if (popover) {
                popover.style.display = popover.style.display === "block" ? "none" : "block";
            }
        });
    });

    // Close popover buttons
    wrapper.querySelectorAll(".btn-close-popover").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const popover = document.getElementById(`palette-popover-${id}`);
            if (popover) popover.style.display = "none";
        });
    });

    // Color swatch click inside popover
    wrapper.querySelectorAll(".color-palette-popover .color-swatch-btn").forEach(swatch => {
        swatch.addEventListener("click", (e) => {
            e.stopPropagation();
            const color = swatch.dataset.color;
            const row = swatch.closest(".status-item-row");
            if (row) {
                row.dataset.color = color;
                const circle = row.querySelector(".color-preview-circle");
                if (circle) circle.style.backgroundColor = color;
                const customInput = row.querySelector(".custom-color-input");
                if (customInput) customInput.value = color;

                const popover = swatch.closest(".color-palette-popover");
                if (popover) {
                    popover.querySelectorAll(".color-swatch-btn").forEach(s => {
                        s.classList.remove("active");
                        s.innerHTML = "";
                    });
                    swatch.classList.add("active");
                    swatch.innerHTML = '<i class="fa-solid fa-check" style="font-size:9px; color:white; text-shadow:0 0 2px rgba(0,0,0,0.8);"></i>';
                    popover.style.display = "none";
                }
            }
        });
    });

    // Custom color input inside popover
    wrapper.querySelectorAll(".custom-color-input").forEach(input => {
        input.addEventListener("input", (e) => {
            const color = e.target.value;
            const row = input.closest(".status-item-row");
            if (row) {
                row.dataset.color = color;
                const circle = row.querySelector(".color-preview-circle");
                if (circle) circle.style.backgroundColor = color;
            }
        });
    });

    // Delete handler
    wrapper.querySelectorAll(".btn-delete-status-item").forEach(btn => {
        btn.addEventListener("click", () => {
            syncStatusModalInputsSilently();
            deleteCustomStatus(btn.dataset.id);
        });
    });
}

function moveCustomStatus(stId, direction) {
    const idx = state.customStatuses.findIndex(s => s.id === stId);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= state.customStatuses.length) return;

    const temp = state.customStatuses[idx];
    state.customStatuses[idx] = state.customStatuses[targetIdx];
    state.customStatuses[targetIdx] = temp;

    saveState();
    renderStatusSettingModal();
    renderStatusSummaryChips();
    renderPlaceList();
}

function addCustomStatus(label, color) {
    if (!label || !label.trim()) {
        alert("상태 항목 명칭을 입력해 주세요.");
        return;
    }
    const cleanLabel = label.trim();
    if (state.customStatuses.some(s => s.label === cleanLabel)) {
        alert("이미 동일한 명칭의 상태 항목이 존재합니다.");
        return;
    }

    const matchedPalette = PALETTE_20_COLORS.find(p => p.color.toLowerCase() === (color || "").toLowerCase());
    const matchedEmoji = matchedPalette ? matchedPalette.emoji : "🏷️";

    const newStatus = {
        id: `status-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        label: cleanLabel,
        color: color || "#00c853",
        icon: matchedEmoji
    };

    state.customStatuses.push(newStatus);
    saveState();
    renderStatusSettingModal();
    renderStatusSummaryChips();
    renderPlaceList();
    alert(`[${cleanLabel}] 상태 항목이 성공적으로 추가되었습니다!`);
}

function deleteCustomStatus(stId) {
    const st = state.customStatuses.find(s => s.id === stId);
    if (!st) return;

    if (state.customStatuses.length <= 1) {
        alert("최소 1개 이상의 상태 항목이 유지되어야 합니다.");
        return;
    }

    if (confirm(`[${st.label}] 상태 항목을 삭제하시겠습니까?`)) {
        state.customStatuses = state.customStatuses.filter(s => s.id !== stId);
        saveState();
        renderStatusSettingModal();
        renderStatusSummaryChips();
        renderPlaceList();
    }
}

function resetCustomStatuses() {
    if (confirm("상태 항목 설정을 초기 기본값(미방문, 완료, 연락중)으로 복원하시겠습니까?")) {
        state.customStatuses = [...DEFAULT_STATUSES];
        saveState();
        renderStatusSettingModal();
        renderStatusSummaryChips();
        renderPlaceList();
        alert("상태 항목 설정이 기본값으로 초기화되었습니다.");
    }
}

/* ----------------------------------------------------
   Master Excel Backup & Restore Functions (.xlsx)
---------------------------------------------------- */
function exportMasterBackupExcel() {
    if (typeof XLSX === "undefined") {
        alert("XLSX 엑셀 라이브러리가 로드되지 않았습니다. 인터넷 연결 상태를 확인해 주세요.");
        return;
    }

    // Sheet 1: 경로당 전체 데이터
    const placesRows = state.places.map((p, index) => {
        const repObj = state.salesReps.find(r => r.id === p.salesRep || r.name === p.salesRep);
        const repName = repObj ? repObj.name : (p.salesRep || "미지정");
        const statusObj = getStatusObj(p.status);
        const contactsStr = (p.contacts || []).map(c => `${c.role}: ${c.phone}`).join(" / ");

        return {
            "ID": p.id || "",
            "순번": index + 1,
            "경로당명": p.name || "",
            "도로명주소": p.address || "",
            "지번주소": p.jibunAddress || "",
            "위도(Lat)": p.lat || "",
            "경도(Lng)": p.lng || "",
            "상태코드": p.status || "verified",
            "상태명": statusObj.label,
            "특이사항/메모": p.memo || "",
            "소속그룹(폴더)": p.group || "",
            "담당영업사원": repName,
            "연락처": contactsStr
        };
    });

    // Sheet 2: 영업사원 목록
    const salesRepsRows = state.salesReps.map(r => ({
        "영업사원ID": r.id || "",
        "이름": r.name || "",
        "연락처": r.phone || "",
        "담당지역/메모": r.memo || ""
    }));

    // Sheet 3: 상태 항목 설정
    const statusRows = state.customStatuses.map(s => ({
        "상태ID": s.id || "",
        "상태명": s.label || "",
        "색상": s.color || ""
    }));

    const wb = XLSX.utils.book_new();
    const wsPlaces = XLSX.utils.json_to_sheet(placesRows);
    const wsSalesReps = XLSX.utils.json_to_sheet(salesRepsRows);
    const wsStatuses = XLSX.utils.json_to_sheet(statusRows);

    XLSX.utils.book_append_sheet(wb, wsPlaces, "경로당 전체데이터");
    XLSX.utils.book_append_sheet(wb, wsSalesReps, "영업사원 목록");
    XLSX.utils.book_append_sheet(wb, wsStatuses, "상태 항목 설정");

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `경로당지도_마스터전체백업_${dateStr}.xlsx`);
    alert("👑 마스터 엑셀 전체 백업 파일(.xlsx) 다운로드가 완료되었습니다!");
}

function importMasterBackupExcel(file) {
    if (!file) {
        alert("복원할 엑셀 (.xlsx) 파일을 선택해 주세요.");
        return;
    }
    if (typeof XLSX === "undefined") {
        alert("XLSX 엑셀 라이브러리가 로드되지 않았습니다.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            const sheetPlacesName = workbook.SheetNames.find(n => n.includes("경로당")) || workbook.SheetNames[0];
            const sheetPlaces = workbook.Sheets[sheetPlacesName];
            const rawPlaces = XLSX.utils.sheet_to_json(sheetPlaces);

            if (!Array.isArray(rawPlaces) || rawPlaces.length === 0) {
                alert("엑셀 파일에 유효한 경로당 데이터 시트가 없거나 빈 파일입니다.");
                return;
            }

            if (!confirm(`정말로 엑셀 파일(${rawPlaces.length}개 경로당 레코드) 데이터로 마스터 전체 복원을 진행하시겠습니까?\n\n※ 현재 저장된 데이터가 엑셀 백업본 시점으로 재구성됩니다.`)) {
                return;
            }

            const newPlaces = rawPlaces.map((row, i) => {
                const name = row["경로당명"] || row["경로당"] || row["이름"] || "경로당";
                const address = row["도로명주소"] || row["주소"] || "";
                const jibunAddress = row["지번주소"] || "";
                const lat = parseFloat(row["위도(Lat)"] || row["위도"]) || 35.0682;
                const lng = parseFloat(row["경도(Lng)"] || row["경도"]) || 127.7511;
                const status = row["상태코드"] || "verified";
                const memo = row["특이사항/메모"] || row["특이사항"] || row["메모"] || "";
                const group = row["소속그룹(폴더)"] || row["그룹"] || row["소속그룹"] || "새 경로당 그룹";
                const salesRep = row["담당영업사원"] || row["영업사원"] || "";

                let contacts = [];
                const contactsStr = row["연락처"] || row["연락처정보"] || "";
                if (contactsStr && typeof contactsStr === "string") {
                    contactsStr.split("/").forEach(part => {
                        const parsed = parseContactString(part.trim());
                        if (parsed && parsed.phone) contacts.push(parsed);
                    });
                }

                return {
                    id: row["ID"] || `place-excel-${Date.now()}-${i}`,
                    name: name,
                    address: address,
                    jibunAddress: jibunAddress,
                    lat: lat,
                    lng: lng,
                    status: status,
                    memo: memo,
                    group: group,
                    salesRep: salesRep,
                    contacts: contacts
                };
            });

            // Sheet 2: 영업사원 복원 (if present)
            const sheetRepsName = workbook.SheetNames.find(n => n.includes("영업사원"));
            if (sheetRepsName) {
                const rawReps = XLSX.utils.sheet_to_json(workbook.Sheets[sheetRepsName]);
                if (Array.isArray(rawReps) && rawReps.length > 0) {
                    state.salesReps = rawReps.map(r => ({
                        id: r["영업사원ID"] || `rep-${Date.now()}-${Math.random().toString(36).substr(2,4)}`,
                        name: r["이름"] || "",
                        phone: r["연락처"] || "",
                        memo: r["담당지역/메모"] || r["메모"] || ""
                    })).filter(r => r.name);
                }
            }

            // Sheet 3: 상태 항목 설정 복원 (if present)
            const sheetStatusName = workbook.SheetNames.find(n => n.includes("상태"));
            if (sheetStatusName) {
                const rawStatuses = XLSX.utils.sheet_to_json(workbook.Sheets[sheetStatusName]);
                if (Array.isArray(rawStatuses) && rawStatuses.length > 0) {
                    state.customStatuses = rawStatuses.map(s => ({
                        id: s["상태ID"] || s["id"] || `status-${Date.now()}`,
                        label: s["상태명"] || s["label"] || "미확인",
                        color: s["색상"] || s["color"] || "#3b82f6"
                    }));
                }
            }

            state.places = deduplicatePlaces(newPlaces);
            state.groups = [];
            state.places.forEach(p => {
                if (p.group && !state.groups.includes(p.group)) {
                    state.groups.push(p.group);
                }
            });

            saveState();
            renderGroupSelect();
            renderSalesRepSelects();
            renderStatusSummaryChips();
            renderPlaceList(true);

            const modalBackup = document.getElementById("modal-master-backup");
            if (modalBackup) modalBackup.style.display = "none";

            alert(`🎉 마스터 엑셀 파일로부터 총 ${newPlaces.length}개 경로당 데이터가 100% 성공적으로 복원되었습니다!`);
        } catch (err) {
            alert("엑셀 파일 파싱 복원 중 오류가 발생했습니다: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

async function renderSnapshotList() {
    const container = document.getElementById("snapshot-list-container");
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:12px; padding:10px;">기록 불러오는 중...</div>';
    const snapshots = await getAutoSnapshots();

    if (!snapshots || snapshots.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:12px; padding:10px;">저장된 자동 백업 이력이 아직 없습니다. (데이터를 추가하거나 수정하면 자동으로 생성됩니다)</div>';
        return;
    }

    // Sort descending by timestamp
    snapshots.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    container.innerHTML = "";
    snapshots.forEach((snap) => {
        const item = document.createElement("div");
        item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:8px 12px; gap:8px;";
        item.innerHTML = `
            <div>
                <div style="font-size:12.5px; font-weight:700; color:#1e293b;">
                    📅 ${snap.dateStr}
                    <span style="font-size:11px; font-weight:600; color:#4338ca; background:#e0e7ff; padding:2px 6px; border-radius:4px; margin-left:6px;">
                        경로당 ${snap.count || 0}개
                    </span>
                </div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">
                    폴더: ${(snap.groups || []).join(", ") || "기본"}
                </div>
            </div>
            <button type="button" class="btn btn-sm btn-primary btn-restore-snap" style="font-size:11.5px; padding:4px 10px; font-weight:700; background:#4f46e5; border-color:#4f46e5; white-space:nowrap;">
                <i class="fa-solid fa-rotate-left"></i> 이 버전으로 복원
            </button>
        `;

        item.querySelector(".btn-restore-snap").addEventListener("click", async () => {
            if (confirm(`[${snap.dateStr}] 자동 백업(경로당 ${snap.count}개) 데이터로 복원하시겠습니까?`)) {
                state.places = deduplicatePlaces(snap.places).map(p => {
                    if (p) p.status = normalizePlaceStatus(p.status);
                    return p;
                });
                if (Array.isArray(snap.groups) && snap.groups.length > 0) {
                    state.groups = snap.groups;
                }
                await saveState("snapshot-restore");
                renderGroupSelect();
                renderSalesRepSelects();
                renderStatusSummaryChips();
                renderPlaceList(true);
                alert(`🎉 [${snap.dateStr}] 버전 (${snap.count}개)으로 성공적으로 복원되었습니다!`);
                const modalMasterBackup = document.getElementById("modal-master-backup");
                if (modalMasterBackup) modalMasterBackup.style.display = "none";
            }
        });

        container.appendChild(item);
    });
}


