/**
 * src/services/fuseki.service.ts
 * ======================================================
 * บริการเชื่อมต่อ Apache Jena Fuseki (SPARQL Endpoint)
 *
 * เป้าหมายของไฟล์นี้:
 * 1) อัปโหลดข้อมูล RDF ของ "แผนของนักศึกษา" (แปลงจาก DB) เข้า Fuseki แบบกราฟแยก (named graph)
 * 2) ยิง SPARQL Query เพื่อให้ Fuseki คำนวณ/ตรวจ Rule ให้เรา
 *
 * ทำไมต้องทำแบบกราฟแยก?
 * - dataset หลัก (/studyplan) เก็บ "ความรู้หลักสูตร" (Course, Group, CreditRequirement, Prereq, Rule)
 * - ข้อมูลแผนของนักศึกษาเป็นข้อมูลชั่วคราวและเฉพาะคน → เก็บใน named graph ตาม planId/studentId
 * - เวลา validate รอบใหม่ เรา overwrite กราฟเดิมได้เลย (idempotent)
 *
 * ENV ที่ต้องตั้ง:
 * - FUSEKI_BASE_URL เช่น http://localhost:3030
 * - FUSEKI_DATASET_PATH เช่น /studyplan
 *
 * หมายเหตุ:
 * - Endpoint มาตรฐานของ Fuseki:
 *   - Query:  {DATASET}/sparql
 *   - Update: {DATASET}/update
 *   - Data:   {DATASET}/data   (ใช้สำหรับ PUT/POST RDF เข้ากราฟ)
 */
export type FusekiConfig = {
  baseUrl: string;
  datasetPath: string;
};

export type SparqlSelectResponse = {
  head: { vars: string[] };
  results: {
    bindings: Array<Record<string, { type: string; value: string }>>;
  };
};

function mustGetEnv(name: string, fallback?: string) {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export function getFusekiConfig(): FusekiConfig {
  return {
    baseUrl: mustGetEnv("FUSEKI_BASE_URL", "http://localhost:3030"),
    datasetPath: mustGetEnv("FUSEKI_DATASET_PATH", "/studyplan"),
  };
}

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function fusekiSparqlEndpoint(cfg: FusekiConfig) {
  return joinUrl(cfg.baseUrl, `${cfg.datasetPath}/sparql`);
}

export function fusekiDataEndpoint(cfg: FusekiConfig) {
  return joinUrl(cfg.baseUrl, `${cfg.datasetPath}/data`);
}

/**
 * PUT TTL เข้า named graph (overwrite ทั้งกราฟ)
 *
 * - graphUri: URI ของกราฟ เช่น http://rmutto.ac.th/it-studyplan#graph/plan/123
 * - turtle: RDF/Turtle string
 */
export async function putNamedGraphTurtle(cfg: FusekiConfig, graphUri: string, turtle: string) {
  const url = new URL(fusekiDataEndpoint(cfg));
  url.searchParams.set("graph", graphUri);

  const resp = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      "content-type": "text/turtle; charset=utf-8",
    },
    body: turtle,
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Fuseki PUT graph failed (${resp.status}): ${txt}`);
  }
}

/**
 * POST SPARQL SELECT แล้วคืน JSON bindings
 */
export async function sparqlSelect(cfg: FusekiConfig, query: string): Promise<SparqlSelectResponse> {
  const resp = await fetch(fusekiSparqlEndpoint(cfg), {
    method: "POST",
    headers: {
      "content-type": "application/sparql-query; charset=utf-8",
      accept: "application/sparql-results+json",
    },
    body: query,
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Fuseki SPARQL failed (${resp.status}): ${txt}`);
  }

  return (await resp.json()) as SparqlSelectResponse;
}

/**
 * ดึง ValidationRule (individuals) จาก Fuseki
 * โดยอ่าน:
 * - :ValidationRule
 * - :ruleKey
 * - :ruleStatus
 * - :ruleType
 * - :sparqlText
 * - rdfs:comment
 *
 * หมายเหตุ:
 * - เรา filter เอาเฉพาะ ruleStatus="ACTIVE"
 */
export type FusekiRule = {
  ruleKey: string;
  status?: string;
  type?: string;
  comment?: string;
  sparqlText: string;
};

export async function fetchActiveRules(cfg: FusekiConfig): Promise<FusekiRule[]> {
  const q = `PREFIX : <http://rmutto.ac.th/it-studyplan#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?ruleKey ?status ?type ?comment ?sparqlText WHERE {
  ?r a :ValidationRule ;
     :ruleKey ?ruleKey ;
     :sparqlText ?sparqlText .
  OPTIONAL { ?r :ruleStatus ?status . }
  OPTIONAL { ?r :ruleType ?type . }
  OPTIONAL { ?r rdfs:comment ?comment . }
  FILTER(!BOUND(?status) || ?status = "ACTIVE")
}
ORDER BY ?ruleKey`;

  const out = await sparqlSelect(cfg, q);
  return out.results.bindings.map((b) => ({
    ruleKey: b.ruleKey?.value ?? "UNKNOWN",
    status: b.status?.value,
    type: b.type?.value,
    comment: b.comment?.value,
    sparqlText: b.sparqlText?.value ?? "",
  }));
}
