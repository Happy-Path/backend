// utils/youtube.js
const YT_ID_REGEXES = [
    /(?:v=|\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
];

function extractYouTubeId(url) {
    for (const r of YT_ID_REGEXES) {
        const m = url.match(r);
        if (m && m[1]) return m[1];
    }
    try {
        const u = new URL(url);
        const v = u.searchParams.get('v');
        if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    } catch {}
    return null;
}

function youtubeThumb(id, quality = 'hq') {
    return `https://i.ytimg.com/vi/${id}/${quality}default.jpg`;
}

module.exports = { extractYouTubeId, youtubeThumb };
