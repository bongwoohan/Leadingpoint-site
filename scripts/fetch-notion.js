/**
 * fetch-notion.js
 *
 * Notion '자료' 데이터소스에서 공개=true 인 항목만 가져와
 * documents.html이 읽을 수 있는 data.json 파일을 생성합니다.
 *
 * 핵심: Notion이 제공하는 파일 URL은 1시간 후 만료되는 임시 URL이므로,
 *       각 첨부파일을 실제로 다운로드해서 ./files/ 폴더에 저장하고,
 *       data.json에는 그 영구적인 상대 경로를 기록합니다.
 *
 * 필요한 환경변수:
 *   NOTION_TOKEN       - Notion Internal Integration Secret (ntn_... 형태)
 *   NOTION_DATA_SOURCE_ID - '자료' 데이터소스 ID
 *
 * 실행:
 *   node scripts/fetch-notion.js
 *
 * 결과:
 *   ./data.json  생성 (저장소 최상위, documents.html과 같은 위치)
 *   ./files/*    각 첨부파일 다운로드 저장
 */

const fs = require("fs");
const path = require("path");

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATA_SOURCE_ID = process.env.NOTION_DATA_SOURCE_ID;
const NOTION_VERSION = "2025-09-03";

if (!NOTION_TOKEN) {
  console.error("오류: NOTION_TOKEN 환경변수가 설정되지 않았습니다.");
  process.exit(1);
}
if (!DATA_SOURCE_ID) {
  console.error("오류: NOTION_DATA_SOURCE_ID 환경변수가 설정되지 않았습니다.");
  process.exit(1);
}

// Notion Data Source Query API
// https://developers.notion.com/reference/query-a-data-source
const QUERY_URL = `https://api.notion.com/v1/data_sources/${DATA_SOURCE_ID}/query`;

const REPO_ROOT = path.join(__dirname, "..");
const FILES_DIR = path.join(REPO_ROOT, "files");

/**
 * 공개 = true 인 페이지만 가져오기 (페이지네이션 처리 포함)
 */
async function fetchPublicItems() {
  const items = [];
  let cursor = undefined;
  let hasMore = true;

  while (hasMore) {
    const body = {
      filter: {
        property: "공개",
        checkbox: { equals: true },
      },
      sorts: [{ property: "날짜", direction: "descending" }],
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(QUERY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Notion API 오류 (${res.status}): ${errText}`);
    }

    const json = await res.json();
    items.push(...json.results);
    hasMore = json.has_more;
    cursor = json.next_cursor;
  }

  return items;
}

/**
 * Notion 속성 값을 추출하는 헬퍼들
 */
function getTitle(prop) {
  if (!prop || !prop.title) return "";
  return prop.title.map((t) => t.plain_text).join("");
}

function getText(prop) {
  if (!prop || !prop.rich_text) return "";
  return prop.rich_text.map((t) => t.plain_text).join("");
}

function getSelect(prop) {
  if (!prop || !prop.select) return "";
  return prop.select.name || "";
}

function getDate(prop) {
  if (!prop || !prop.date) return "";
  return prop.date.start || "";
}

function getFiles(prop) {
  if (!prop || !prop.files) return [];
  return prop.files.map((f) => {
    const url = f.type === "external" ? f.external.url : f.file.url;
    return { name: f.name, url };
  });
}

/**
 * 파일명을 URL/파일시스템에 안전한 형태로 변환
 * (한글, 공백, 특수문자는 유지하되 경로 깨질 수 있는 문자만 제거)
 */
function sanitizeFilename(name) {
  return name
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 페이지 ID + 파일 인덱스로 고유하고 충돌 없는 파일명 생성
 * 예: "1f2a3b4c-제안서.pdf"
 */
function buildStoredFilename(pageId, index, originalName) {
  const shortId = pageId.replace(/-/g, "").slice(0, 8);
  const safeName = sanitizeFilename(originalName || `file-${index}`);
  return `${shortId}-${index}-${safeName}`;
}

/**
 * 주어진 URL의 파일을 다운로드하여 files/ 폴더에 저장.
 * 이미 같은 이름의 파일이 있으면 다시 받지 않고 건너뜀(불필요한 재다운로드 방지).
 */
async function downloadFile(url, storedFilename) {
  const destPath = path.join(FILES_DIR, storedFilename);

  if (fs.existsSync(destPath)) {
    return; // 이미 받아둔 파일은 재다운로드하지 않음
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`파일 다운로드 실패 (${res.status}): ${url}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
}

/**
 * 한 페이지(자료 항목)의 첨부파일들을 모두 다운로드하고,
 * data.json에 기록할 영구 상대경로 목록을 반환
 */
async function processFiles(pageId, rawFiles) {
  const result = [];
  for (let i = 0; i < rawFiles.length; i++) {
    const f = rawFiles[i];
    const storedFilename = buildStoredFilename(pageId, i, f.name);
    await downloadFile(f.url, storedFilename);
    result.push({
      name: f.name,
      url: `files/${storedFilename}`, // 서버에 영구히 존재하는 상대 경로
    });
  }
  return result;
}

/**
 * Notion raw page 객체를 documents.html에서 쓰기 쉬운 형태로 변환
 * (첨부파일 다운로드까지 포함하므로 async)
 */
async function transformPage(page) {
  const props = page.properties;
  const rawFiles = getFiles(props["파일과 미디어"]);
  const files = await processFiles(page.id, rawFiles);

  return {
    id: page.id,
    name: getTitle(props["이름"]),
    memo: getText(props["메모"]),
    type: getSelect(props["종류"]),
    author: getSelect(props["Author"]),
    fileType: getSelect(props["File type"]),
    date: getDate(props["날짜"]),
    files,
  };
}

async function main() {
  console.log("Notion에서 공개 자료 목록을 가져오는 중...");
  const rawItems = await fetchPublicItems();
  console.log(`총 ${rawItems.length}개의 공개 자료를 찾았습니다.`);

  if (!fs.existsSync(FILES_DIR)) {
    fs.mkdirSync(FILES_DIR, { recursive: true });
  }

  const items = [];
  for (const page of rawItems) {
    console.log(`처리 중: ${getTitle(page.properties["이름"]) || page.id}`);
    items.push(await transformPage(page));
  }

  const output = {
    generatedAt: new Date().toISOString(),
    count: items.length,
    items,
  };

  const outPath = path.join(REPO_ROOT, "data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`data.json 생성 완료: ${outPath}`);
  console.log(`첨부파일 저장 위치: ${FILES_DIR}`);
}

main().catch((err) => {
  console.error("스크립트 실행 중 오류 발생:", err);
  process.exit(1);
});