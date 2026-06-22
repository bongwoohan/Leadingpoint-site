/**
 * fetch-notion.js
 *
 * Notion '자료' 데이터소스에서 공개=true 인 항목만 가져와
 * documents.html이 읽을 수 있는 data.json 파일을 생성합니다.
 *
 * 필요한 환경변수:
 *   NOTION_TOKEN       - Notion Internal Integration Secret (ntn_... 형태)
 *   NOTION_DATA_SOURCE_ID - '자료' 데이터소스 ID
 *
 * 실행:
 *   node scripts/fetch-notion.js
 *
 * 결과:
 *   ./data.json 파일 생성 (저장소 최상위, documents.html과 같은 위치)
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
 * Notion raw page 객체를 documents.html에서 쓰기 쉬운 형태로 변환
 */
function transformPage(page) {
  const props = page.properties;
  return {
    id: page.id,
    name: getTitle(props["이름"]),
    memo: getText(props["메모"]),
    type: getSelect(props["종류"]),
    author: getSelect(props["Author"]),
    fileType: getSelect(props["File type"]),
    date: getDate(props["날짜"]),
    files: getFiles(props["파일과 미디어"]),
  };
}

async function main() {
  console.log("Notion에서 공개 자료 목록을 가져오는 중...");
  const rawItems = await fetchPublicItems();
  console.log(`총 ${rawItems.length}개의 공개 자료를 찾았습니다.`);

  const items = rawItems.map(transformPage);

  const output = {
    generatedAt: new Date().toISOString(),
    count: items.length,
    items,
  };

  const outPath = path.join(__dirname, "..", "data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`data.json 생성 완료: ${outPath}`);
}

main().catch((err) => {
  console.error("스크립트 실행 중 오류 발생:", err);
  process.exit(1);
});